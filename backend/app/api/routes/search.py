from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.services.search_service import semantic_search


router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search_documents(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tìm các đoạn tài liệu gần nghĩa với câu người dùng nhập.
    """

    return semantic_search(
        db,
        query_text=q,
        current_user=current_user,
        limit=limit,
    )
