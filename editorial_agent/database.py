from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Strip surrounding quotes that may come from .env or Render dashboard
DATABASE_URL = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")

# Try PostgreSQL first, fall back to SQLite if not configured or unreachable
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    try:
        # Supabase requires SSL and IPv4 via pooler
        engine = create_engine(
            DATABASE_URL,
            connect_args={"sslmode": "require"},
            pool_pre_ping=True,
        )
        # Test the connection immediately
        with engine.connect() as conn:
            pass
        print("✅ Connected to PostgreSQL (Supabase)")
    except Exception as e:
        print(f"⚠️  PostgreSQL failed ({e}), falling back to SQLite")
        engine = create_engine(
            "sqlite:////tmp/editorial_agent.db",
            connect_args={"check_same_thread": False}
        )
else:
    print("ℹ️  No PostgreSQL URL found, using SQLite")
    engine = create_engine(
        "sqlite:////tmp/editorial_agent.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

