import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image, PngImagePlugin

from app.database.base import Base
from app.models.user import User
from app.models.chat import Chat
from app.models.chat_message import ChatMessage
from app.models.chat_attachment import ChatAttachment
from app.api.routes import chat
from app.services import chat_image_service as images, rag_service
from app.api.dependencies import get_current_user
from app.database.connection import get_db


def png_bytes():
    b=io.BytesIO();meta=PngImagePlugin.PngInfo();meta.add_text('Private','must not persist')
    Image.new('RGB',(80,60),'white').save(b,'PNG',pnginfo=meta)
    return b.getvalue()


class ChatImagesTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.settings=patch.object(images.settings,'storage_path',self.temp.name);self.settings.start()
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session=sessionmaker(bind=self.engine)
        with self.Session() as db:
            for i in (1,2):db.add(User(id=i,full_name=f'Test {i}',email=f'{i}@example.test',hashed_password='test-only',role='individual'))
            db.commit()
        self.identity=1
        self.app=FastAPI();self.app.include_router(chat.router,prefix='/api/v1')
        def database():
            with self.Session()as db:yield db
        self.app.dependency_overrides[get_db]=database
        self.app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=self.identity,organization_id=None)
        self.client=TestClient(self.app, raise_server_exceptions=False)
        self.mock=patch.object(chat,'answer',return_value='Nội dung trong ảnh [Ảnh 1].');self.ai=self.mock.start()

    def tearDown(self):
        self.client.close();self.mock.stop();self.settings.stop();self.engine.dispose();self.temp.cleanup()

    def post_image(self,name='test.png',data=None,**fields):
        return self.client.post('/api/v1/chat/with-images',data={'question':'Ảnh ghi gì?',**fields},files=[('images',(name,data if data is not None else png_bytes(),'image/png'))])

    def test_image_saved_history_and_private_download(self):
        response=self.post_image();self.assertEqual(response.status_code,200,response.text)
        payload=response.json();attachment=payload['user_message']['attachments'][0]
        history=self.client.get(f"/api/v1/chat/{payload['chat_id']}").json()
        self.assertEqual(history['messages'][0]['attachments'][0]['id'],attachment['id'])
        downloaded=self.client.get('/api/v1'+attachment['url'])
        self.assertEqual(downloaded.status_code,200)
        self.assertEqual(downloaded.headers['content-type'],'image/png')
        self.assertIn('no-store',downloaded.headers['cache-control'])
        self.assertNotIn('Private',Image.open(io.BytesIO(downloaded.content)).info)
        self.identity=2
        self.assertEqual(self.client.get('/api/v1'+attachment['url']).status_code,404)
        self.assertEqual(self.client.get(f"/api/v1/chat/{payload['chat_id']}").status_code,403)

    def test_foreign_chat_rejected_before_ai(self):
        payload=self.post_image().json();self.identity=2;self.ai.reset_mock()
        response=self.post_image(chat_id=str(payload['chat_id']))
        self.assertEqual(response.status_code,403);self.ai.assert_not_called()

    def test_invalid_image_rejected_without_chat_or_ai(self):
        self.assertEqual(self.post_image(data=b'<svg onload="alert(1)"></svg>').status_code,400)
        self.ai.assert_not_called()
        with self.Session()as db:self.assertEqual(db.query(Chat).count(),0)

    def test_image_size_limit(self):
        self.assertEqual(self.post_image(data=b'x'*(images.MAX_IMAGE_BYTES+1)).status_code,400)
        self.ai.assert_not_called()

    def test_image_count_limit(self):
        response=self.client.post('/api/v1/chat/with-images',files=[('images',(f'{i}.png',png_bytes(),'image/png'))for i in range(4)])
        self.assertEqual(response.status_code,400);self.ai.assert_not_called()

    def test_image_only_has_default_question(self):
        response=self.post_image(question='')
        self.assertEqual(response.status_code,200)
        self.assertIn('ảnh đính kèm',response.json()['question'])

    def test_followup_uses_latest_saved_images(self):
        payload=self.post_image().json();self.ai.reset_mock()
        response=self.client.post('/api/v1/chat',json={'chat_id':payload['chat_id'],'question':'Giải thích thêm ảnh đó'})
        self.assertEqual(response.status_code,200,response.text)
        supplied=self.ai.call_args.kwargs['images'];self.assertTrue(supplied[0].from_history)
        self.assertEqual(len(response.json()['user_message']['attachments']),0)

    def test_llm_failure_does_not_leave_chat_messages_or_files(self):
        self.ai.side_effect=RuntimeError('synthetic AI failure')
        self.assertEqual(self.post_image().status_code,500)
        with self.Session()as db:
            self.assertEqual(db.query(Chat).count(),0)
            self.assertEqual(db.query(ChatMessage).count(),0)
            self.assertEqual(db.query(ChatAttachment).count(),0)
        self.assertEqual(list(Path(self.temp.name).rglob('*.png')),[])

    def test_commit_failure_removes_written_images(self):
        from sqlalchemy.orm import Session
        with patch.object(Session,'commit',side_effect=RuntimeError('synthetic commit failure')):
            self.assertEqual(self.post_image().status_code,500)
        self.assertEqual(list(Path(self.temp.name).rglob('*.png')),[])
        with self.Session()as db:self.assertEqual(db.query(ChatMessage).count(),0)

    def test_text_chat_still_works(self):
        response=self.client.post('/api/v1/chat',json={'question':'Xin chào'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['user_message']['attachments'],[])
        self.assertNotIn('images',self.ai.call_args.kwargs)

    def test_delete_removes_messages_metadata_and_files(self):
        first=self.post_image().json();second=self.post_image().json()
        attachment=first['user_message']['attachments'][0]
        response=self.client.delete(f"/api/v1/chat/{first['chat_id']}")
        self.assertEqual(response.status_code,204,response.text)
        self.assertEqual(self.client.get('/api/v1'+attachment['url']).status_code,404)
        self.assertEqual(self.client.get(f"/api/v1/chat/{first['chat_id']}").status_code,404)
        self.assertEqual(self.client.get(f"/api/v1/chat/{second['chat_id']}").status_code,200)
        with self.Session()as db:
            self.assertEqual(db.query(Chat).count(),1)
            self.assertEqual(db.query(ChatMessage).count(),2)
            self.assertEqual(db.query(ChatAttachment).count(),1)
        self.assertEqual(len(list(Path(self.temp.name).rglob('*.png'))),1)

    def test_foreign_delete_is_denied(self):
        payload=self.post_image().json();self.identity=2
        self.assertEqual(self.client.delete(f"/api/v1/chat/{payload['chat_id']}").status_code,403)
        self.assertEqual(len(list(Path(self.temp.name).rglob('*.png'))),1)

    def test_delete_failure_keeps_files_and_history(self):
        from sqlalchemy.orm import Session
        payload=self.post_image().json()
        with patch.object(Session,'commit',side_effect=RuntimeError('synthetic delete failure')):
            self.assertEqual(self.client.delete(f"/api/v1/chat/{payload['chat_id']}").status_code,500)
        self.assertEqual(self.client.get(f"/api/v1/chat/{payload['chat_id']}").status_code,200)
        self.assertEqual(len(list(Path(self.temp.name).rglob('*.png'))),1)

    def test_image_passed_to_gemini_without_document_context(self):
        image=images.ChatImage(png_bytes(),'image/png','test.png')
        with patch.object(rag_service,'build_context',return_value=('',[])),patch.object(rag_service.settings,'llm_api_key','synthetic-test-key'),patch.object(rag_service.genai,'Client')as client:
            client.return_value.models.generate_content.return_value=SimpleNamespace(text='Đây là ảnh [Ảnh 1].')
            result=rag_service.answer(None,question='Ảnh ghi gì?',current_user=SimpleNamespace(id=1),images=[image])
            parts=client.return_value.models.generate_content.call_args.kwargs['contents']
            self.assertEqual(parts[-1].inline_data.data,image.data)
            self.assertEqual(parts[-1].inline_data.mime_type,'image/png')
            self.assertIn('Ảnh 1',result)
            self.assertNotIn('Chi tiết nguồn',result)


if __name__=='__main__':unittest.main(verbosity=2)
