from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Strip surrounding quotes that may come from .env or Render dashboard
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/editorial_agent")
DATABASE_URL = DATABASE_URL.strip().strip('"').strip("'")

# Supabase requires SSL — add connect_args
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"},
    pool_pre_ping=True,  # auto-reconnect if connection drops
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
