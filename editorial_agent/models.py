from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

class Media(Base):
    __tablename__ = "media"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    url = Column(String)
    media_type = Column(String)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

class Draft(Base):
    __tablename__ = "drafts"
    id = Column(String, primary_key=True, index=True)
    media_id = Column(String, nullable=True)  # no FK constraint for simplicity
    captions = Column(JSON)
    platforms = Column(JSON)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"
    id = Column(String, primary_key=True, index=True, default=lambda: str(__import__('uuid').uuid4()))
    draft_id = Column(String, nullable=True)
    post_time = Column(DateTime(timezone=True))
    status = Column(String, default="scheduled")

class BrandMention(Base):
    __tablename__ = "brand_mentions"
    id = Column(String, primary_key=True, index=True, default=lambda: str(__import__('uuid').uuid4()))
    platform = Column(String)
    text = Column(String)
    sentiment = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
