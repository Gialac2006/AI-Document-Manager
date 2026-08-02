import os


class Settings:
    app_name: str = os.getenv("APP_NAME", "AI Document Manager")
    database_url: str = os.getenv("DATABASE_URL", "")
    secret_key: str = os.getenv("SECRET_KEY", "")
    vector_db_url: str = os.getenv("VECTOR_DB_URL", "")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")


settings = Settings()
