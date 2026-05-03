import os
import json
import random
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from ai_generator import generate_caption
from social_poster import post_everywhere

PORTFOLIO_DIR = Path(__file__).parent / "portfolio"
STATE_FILE = Path(__file__).parent / "posted_images.json"
DRAFTS_FILE = Path(__file__).parent / "drafts.json"
SCHEDULE_FILE = Path(__file__).parent / "schedule.json"
GITHUB_REPO_URL = os.environ.get("GITHUB_REPO_RAW_URL", "") 

POSTS_PER_RUN = int(os.environ.get("POSTS_PER_RUN", 3)) 

def load_json(file_path):
    if file_path.exists():
        with open(file_path, "r") as f:
            try: return json.load(f)
            except: return []
    return []

def save_json(file_path, data):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

def get_unposted_images(posted_images, drafts, schedule):
    if not PORTFOLIO_DIR.exists():
        PORTFOLIO_DIR.mkdir(parents=True, exist_ok=True)
        return []
    valid_exts = {".jpg", ".jpeg", ".png"}
    all_images = [f.name for f in PORTFOLIO_DIR.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
    
    draft_image_names = [d.get('image') for d in drafts]
    schedule_image_names = [s.get('image') for s in schedule]
    
    unposted_images = [img for img in all_images if img not in posted_images and img not in draft_image_names and img not in schedule_image_names]
    return unposted_images



def calculate_schedule(approved_drafts, frequency_per_day):
    new_schedule = []
    current_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    optimal_hours = [14, 18, 11]
    
    draft_idx = 0
    while draft_idx < len(approved_drafts):
        for i in range(frequency_per_day):
            if draft_idx >= len(approved_drafts): break
            draft = approved_drafts[draft_idx]
            hour = optimal_hours[i % len(optimal_hours)]
            post_time = current_date.replace(hour=hour)
            
            new_schedule.append({
                "image": draft.get("image"),
                "captions": draft.get("captions"),
                "platforms": draft.get("platforms"),
                "post_time": post_time.isoformat()
            })
            draft_idx += 1
        current_date += timedelta(days=1)
    return new_schedule

async def process_draft_generation(image_name):
    # Now returns a tuple: (final_image_name, captions_dict)
    # If image_name was None, final_image_name is the freshly generated one!
    result = await asyncio.to_thread(generate_caption, image_name)
    if not result:
        return None
        
    final_img, captions = result
    
    if captions:
        return {
            "image": final_img,
            "captions": captions,
            "platforms": ["linkedin", "instagram", "facebook", "pinterest"],
            "status": "pending"
        }
    return None

async def main():
    mode = os.environ.get("MODE", "watcher").strip().lower()
    print(f"🚀 Starting Editorial Agent in {mode.upper()} mode...")
    
    posted_images = load_json(STATE_FILE)
    drafts = load_json(DRAFTS_FILE)
    schedule = load_json(SCHEDULE_FILE)

    if mode == "draft":
        unposted = get_unposted_images(posted_images, drafts, schedule)
        
        if not unposted:
            print("📭 Queue is empty. Generating a brand new concept from scratch using Pollinations.ai...")
            task = process_draft_generation(None)
            res = await asyncio.gather(task)
            
            new_drafts = [r for r in res if r]
            drafts.extend(new_drafts)
            save_json(DRAFTS_FILE, drafts)
            print(f"✅ Created {len(new_drafts)} new drafts from scratch. Waiting for user approval.")
            return

        num_to_pick = min(len(unposted), POSTS_PER_RUN)
        selected_images = random.sample(unposted, num_to_pick)
        print(f"📸 Generating multi-platform drafts for {len(selected_images)} images...")
        
        tasks = [process_draft_generation(img) for img in selected_images]
        results = await asyncio.gather(*tasks)
        
        new_drafts = [res for res in results if res]
        drafts.extend(new_drafts)
        save_json(DRAFTS_FILE, drafts)
        print(f"✅ Created {len(new_drafts)} new drafts. Waiting for user approval.")

    elif mode == "schedule":
        frequency = int(os.environ.get("FREQUENCY", 2))
        print(f"📅 Building calendar for frequency: {frequency} posts/day")
        
        approved_drafts = [d for d in drafts if d.get("status") == "approved"]
        if not approved_drafts:
            print("❌ No approved drafts found. Please approve drafts in the Web App first.")
            return
            
        new_calendar = calculate_schedule(approved_drafts, frequency)
        schedule.extend(new_calendar)
        schedule = sorted(schedule, key=lambda x: x['post_time'])
        save_json(SCHEDULE_FILE, schedule)
        
        drafts = [d for d in drafts if d.get("status") != "approved"]
        save_json(DRAFTS_FILE, drafts)
        
        print(f"✅ Successfully scheduled {len(approved_drafts)} posts!")

    elif mode == "watcher" or mode == "publish":
        now = datetime.now(timezone.utc)
        print(f"🕒 Current UTC Time: {now.isoformat()}")
        
        due_posts = []
        future_posts = []
        
        if mode == "publish":
            image_name = os.environ.get("IMAGE_NAME")
            captions_json = os.environ.get("CAPTIONS")
            platforms_env = os.environ.get("SELECTED_PLATFORMS")
            
            if captions_json:
                try:
                    cap_dict = json.loads(captions_json)
                except:
                    # Fallback if they pass a single string somehow
                    cap_dict = {"instagram": captions_json, "linkedin": captions_json}
                    
                due_posts.append({
                    "image": image_name,
                    "captions": cap_dict,
                    "platforms": [p.strip().lower() for p in platforms_env.split(",")] if platforms_env else None
                })
        
        for item in schedule:
            post_time = datetime.fromisoformat(item["post_time"])
            if post_time <= now:
                due_posts.append(item)
            else:
                future_posts.append(item)
                
        if not due_posts:
            print("💤 No posts due at this time. Going back to sleep.")
            return
            
        for post in due_posts:
            img_name = post.get("image")
            print(f"--- Publishing Scheduled Post: {img_name if img_name else 'Text-Only'} ---")
            
            image_urls = []
            if img_name and img_name != "null" and GITHUB_REPO_URL:
                image_urls.append(f"{GITHUB_REPO_URL}{img_name}")
                
            try:
                success = post_everywhere(post.get("captions", {}), image_paths=image_urls, selected_platforms=post.get("platforms"))
            except Exception as e:
                print(f"❌ CRITICAL ERROR during posting: {e}")
                success = False
            
            if success:
                if img_name and img_name != "null":
                    posted_images.append(img_name)
                    save_json(STATE_FILE, posted_images)
                print("✅ Publish successful!")
            else:
                print("❌ Publish failed. Keeping in schedule for retry next hour.")
                future_posts.append(post) # keep it to retry next hour
                
        # Always save the schedule, even if some posts failed, so they retry next hour!
        try:
            save_json(SCHEDULE_FILE, future_posts)
        except Exception as e:
            print(f"Failed to save schedule: {e}")

if __name__ == "__main__":
    asyncio.run(main())
