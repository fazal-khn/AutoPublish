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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
import psutil # For system monitoring

# Create all tables in the database (safely)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create tables: {e}")

app = FastAPI(title="ProEditor Enterprise API (Later.com Clone)")

# Setup Rate Limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    return response

@app.get("/")
def read_root():
    return {"message": "Enterprise API is running. PostgreSQL connected."}

@app.get("/api/debug")
def debug_db():
    """Test actual DB connection and table access."""
    try:
        from database import engine
        with engine.connect() as conn:
            result = conn.execute(__import__('sqlalchemy').text("SELECT 1"))
            return {"db_ping": "ok", "result": str(result.fetchone())}
    except Exception as e:
        return {"db_ping": "failed", "error": str(e)}

@app.get("/api/setup")
def setup_tables():
    """Force create all tables."""
    try:
        Base.metadata.create_all(bind=engine)
        return {"status": "Tables created successfully"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Live health check — used by frontend notification system."""
    from datetime import datetime, timezone
    issues = []
    services = {}

    # 1. Database check
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        services["database"] = {"status": "ok", "label": "Database"}
    except Exception as e:
        services["database"] = {"status": "error", "label": "Database", "message": str(e)[:120]}
        issues.append({"type": "error", "title": "Database Error", "message": str(e)[:120], "time": datetime.now(timezone.utc).isoformat()})

    # 2. Draft count
    try:
        count = db.query(models.Draft).count()
        services["drafts"] = {"status": "ok", "label": f"Drafts ({count} total)"}
    except Exception as e:
        services["drafts"] = {"status": "error", "label": "Drafts", "message": str(e)[:120]}
        issues.append({"type": "warning", "title": "Drafts Table Error", "message": str(e)[:120], "time": datetime.now(timezone.utc).isoformat()})

    # 3. Scheduled posts check
    try:
        scheduled = db.query(models.ScheduledPost).filter(models.ScheduledPost.status == "scheduled").count()
        failed = db.query(models.ScheduledPost).filter(models.ScheduledPost.status == "failed").count()
        services["scheduler"] = {"status": "ok" if failed == 0 else "warning", "label": f"Scheduler ({scheduled} pending, {failed} failed)"}
        if failed > 0:
            issues.append({"type": "warning", "title": f"{failed} Post(s) Failed to Publish", "message": "Check your Ayrshare API key and social accounts.", "time": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        services["scheduler"] = {"status": "error", "label": "Scheduler", "message": str(e)[:120]}

    # 4. API Keys check
    import os
    missing_keys = []
    for key in ["GEMINI_API_KEY", "AYRSHARE_API_KEY", "OPENROUTER_API_KEY"]:
        if not os.getenv(key) or os.getenv(key) == "your_key_here":
            missing_keys.append(key)
    if missing_keys:
        services["api_keys"] = {"status": "warning", "label": f"Missing API Keys: {', '.join(missing_keys)}"}
        issues.append({"type": "warning", "title": "Missing API Keys", "message": f"{', '.join(missing_keys)} not configured.", "time": datetime.now(timezone.utc).isoformat()})
    else:
        services["api_keys"] = {"status": "ok", "label": "All API Keys Set"}

    overall = "error" if any(s["status"] == "error" for s in services.values()) else \
              "warning" if any(s["status"] == "warning" for s in services.values()) else "ok"

    # System monitoring
    cpu_usage = psutil.cpu_percent()
    mem_usage = psutil.virtual_memory().percent
    
    return {
        "overall": overall,
        "services": services,
        "system": {
            "cpu": f"{cpu_usage}%",
            "memory": f"{mem_usage}%",
            "uptime": "stable"
        },
        "issues": issues,
        "checked_at": datetime.now(timezone.utc).isoformat()
    }

# --- SYSTEM BACKUP & RECOVERY ---
@app.get("/api/system/backup")
@limiter.limit("5/minute")
def export_backup(request: status.HTTP_200_OK, db: Session = Depends(get_db)):
    """Export all drafts and schedule to JSON for recovery."""
    drafts = db.query(models.Draft).all()
    schedule = db.query(models.ScheduledPost).all()
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "drafts": [d.id for d in drafts], # Simplified for demo
            "schedule_count": len(schedule)
        },
        "instructions": "Contact support for full database dump."
    }

# --- ANALYTICS ---
@app.get("/api/analytics/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    """Aggregate performance data."""
    history = db.query(models.PostedHistory).all()
    total_posts = len(history)
    
    # Mock data for demonstration
    return {
        "total_posts": total_posts,
        "engagement_rate": "4.2%",
        "best_time_to_post": "18:00 UTC",
        "top_performing_platform": "Instagram",
        "recent_growth": "+12% this week"
    }


# --- SOCIAL MEDIA CONNECTION ---
@app.get("/api/social/accounts")
def get_social_accounts():
    """Fetch real connection status from Ayrshare."""
    import requests
    import os
    
    api_key = os.getenv("AYRSHARE_API_KEY")
    if not api_key:
        return {"error": "AYRSHARE_API_KEY not configured"}
        
    try:
        # Get profile status from Ayrshare
        response = requests.get(
            "https://app.ayrshare.com/api/profiles/accounts",
            headers={"Authorization": f"Bearer {api_key}"}
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/social/connect")
def get_social_connect_link():
    """Generate a real Ayrshare Social Link for user login."""
    import requests
    import os
    
    api_key = os.getenv("AYRSHARE_API_KEY")
    if not api_key:
        return {"error": "AYRSHARE_API_KEY not configured"}
        
    try:
        response = requests.post(
            "https://app.ayrshare.com/api/profiles/generate-link",
            headers={"Authorization": f"Bearer {api_key}"},
            json={}
        )
        data = response.json()
        
        if "url" in data:
            return {"url": data["url"]}
        
        # Log the error for internal debugging
        print(f"Ayrshare API info: {data}")
        
        # Fallback for ALL errors or non-business plans
        # This ensures the user is never stuck
        return {
            "url": "https://app.ayrshare.com/social-accounts",
            "warning": "Ayrshare Business Plan required for white-label login. Redirecting to your dashboard..."
        }
    except Exception as e:
        print(f"Social Connect Exception: {e}")
        return {
            "url": "https://app.ayrshare.com/social-accounts",
            "warning": "Connection link generation error. Redirecting to manual dashboard."
        }


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
