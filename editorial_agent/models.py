from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

class Media(Base):
    __tablename__ = "media"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    url = Column(String)
    media_type = Column(String) # image, video
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

class Draft(Base):
    __tablename__ = "drafts"
    id = Column(String, primary_key=True, index=True)
    media_id = Column(String, ForeignKey("media.id"), nullable=True)
    captions = Column(JSON) # e.g. {"instagram": "...", "x": "..."}
    platforms = Column(JSON) # e.g. ["instagram", "x"]
    status = Column(String, default="pending") # pending, approved
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"
    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(String, ForeignKey("drafts.id"))
    post_time = Column(DateTime(timezone=True))
    status = Column(String, default="scheduled") # scheduled, published, failed
    
class BrandMention(Base):
    __tablename__ = "brand_mentions"
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)
    text = Column(String)
    sentiment = Column(String) # positive, neutral, negative
    created_at = Column(DateTime(timezone=True), server_default=func.now())
