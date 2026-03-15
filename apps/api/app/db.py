from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_database_url

DATABASE_URL = get_database_url()

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
