from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# We will use a local PostgreSQL database
# Defaulting to localhost. For docker, this would be 'db' instead of 'localhost'.
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/editorial_agent")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
