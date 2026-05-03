from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db, SessionLocal
import models
import uuid
import asyncio
from datetime import datetime, timezone
import ai_generator
import social_poster

# Create all tables in the database (safely)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create tables: {e}")

app = FastAPI(title="ProEditor Enterprise API (Later.com Clone)")

# Setup CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Enterprise API is running. PostgreSQL connected."}

# --- DRAFTS ---
@app.get("/api/drafts")
def get_drafts(db: Session = Depends(get_db)):
    drafts = db.query(models.Draft).all()
    # Serialize for frontend
    return [{"id": d.id, "image_name": d.media_id, "captions": d.captions, "platforms": d.platforms, "status": d.status} for d in drafts]

@app.post("/api/drafts")
def create_draft(draft: dict, db: Session = Depends(get_db)):
    db_draft = models.Draft(
        id=str(uuid.uuid4()),
        media_id=draft.get("media_id"),
        captions=draft.get("captions", {}),
        platforms=draft.get("platforms", []),
        status="pending"
    )
    db.add(db_draft)
    db.commit()
    db.refresh(db_draft)
    return {"status": "success", "draft_id": db_draft.id}

@app.put("/api/drafts/{draft_id}")
def update_draft(draft_id: str, updates: dict, db: Session = Depends(get_db)):
    db_draft = db.query(models.Draft).filter(models.Draft.id == draft_id).first()
    if not db_draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if "captions" in updates:
        db_draft.captions = updates["captions"]
    if "platforms" in updates:
        db_draft.platforms = updates["platforms"]
    if "status" in updates:
        db_draft.status = updates["status"]
        
    db.commit()
    return {"status": "success"}

@app.delete("/api/drafts/{draft_id}")
def delete_draft(draft_id: str, db: Session = Depends(get_db)):
    db_draft = db.query(models.Draft).filter(models.Draft.id == draft_id).first()
    if not db_draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    db.delete(db_draft)
    db.commit()
    return {"status": "success"}

# --- SCHEDULE ---
@app.get("/api/schedule")
def get_schedule(db: Session = Depends(get_db)):
    schedule = db.query(models.ScheduledPost).all()
    return schedule

@app.post("/api/schedule")
def create_schedule(posts: list, db: Session = Depends(get_db)):
    # This expects a list of posts
    for post in posts:
        db_post = models.ScheduledPost(
            draft_id=post.get("draft_id"),
            post_time=post.get("post_time"),
            status="scheduled"
        )
        db.add(db_post)
    db.commit()
    return {"status": "success", "scheduled_count": len(posts)}

# --- MEDIA ---
@app.get("/api/media")
def get_media(db: Session = Depends(get_db)):
    media = db.query(models.Media).all()
    return media

@app.get("/api/queue")
def get_queue(db: Session = Depends(get_db)):
    # Returns just filenames for the queue view
    media = db.query(models.Media).all()
    return [m.filename for m in media]

@app.get("/api/history")
def get_history(db: Session = Depends(get_db)):
    # Return published posts
    history = db.query(models.ScheduledPost).filter(models.ScheduledPost.status == "published").all()
    return history

from fastapi import UploadFile, File
import shutil
import os

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Mock upload saving logic
    upload_dir = "portfolio"
    os.makedirs(upload_dir, exist_ok=True)
    file_location = f"{upload_dir}/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    # Save to db
    db_media = models.Media(
        id=str(uuid.uuid4()),
        filename=file.filename,
        media_type=file.content_type
    )
    db.add(db_media)
    db.commit()
    return {"filename": file.filename}

@app.post("/api/generate")
async def generate_draft(image_name: str = None, db: Session = Depends(get_db)):
    # Use real AI generator
    # We run it in a thread because generate_caption is synchronous
    final_img, captions = await asyncio.to_thread(ai_generator.generate_caption, image_name)
    
    db_draft = models.Draft(
        id=str(uuid.uuid4()),
        media_id=final_img,
        captions=captions or {"instagram": "AI generated caption!", "x": "AI generated tweet!"},
        platforms=["instagram", "linkedin", "pinterest"],
        status="pending"
    )
    db.add(db_draft)
    
    # If a new image was generated, ensure it's in the media table
    if final_img and not db.query(models.Media).filter_by(filename=final_img).first():
        db_media = models.Media(
            id=str(uuid.uuid4()),
            filename=final_img,
            media_type="image/jpeg"
        )
        db.add(db_media)

    db.commit()
    return {"status": "success", "draft_id": db_draft.id, "image": final_img}

# Background worker to publish scheduled posts
async def schedule_worker():
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            # Find posts due to be published
            due_posts = db.query(models.ScheduledPost).filter(
                models.ScheduledPost.status == "scheduled",
                models.ScheduledPost.post_time <= now
            ).all()

            for post in due_posts:
                draft = db.query(models.Draft).filter_by(id=post.draft_id).first()
                if draft:
                    image_path = None
                    if draft.media_id:
                        media = db.query(models.Media).filter_by(filename=draft.media_id).first()
                        if media:
                            image_path = [f"portfolio/{media.filename}"]
                            
                    print(f"🚀 Publishing post for draft {draft.id}...")
                    success = social_poster.post_everywhere(
                        captions_dict=draft.captions, 
                        image_paths=image_path, 
                        selected_platforms=draft.platforms
                    )
                    
                    if success:
                        post.status = "published"
                    else:
                        post.status = "failed"
                    db.commit()
            db.close()
        except Exception as e:
            print(f"Background worker error: {e}")
            
        await asyncio.sleep(60) # check every minute

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(schedule_worker())

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
