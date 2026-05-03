import os
import requests
from dotenv import load_dotenv

load_dotenv()

AYRSHARE_API_KEY = os.environ.get("AYRSHARE_API_KEY")
AYRSHARE_URL = "https://app.ayrshare.com/api/post"

BUFFER_ACCESS_TOKEN = os.environ.get("BUFFER_ACCESS_TOKEN")
BUFFER_API_BASE = "https://api.bufferapp.com/1"

def post_to_ayrshare(caption, image_paths=None, platforms=None):
    if not AYRSHARE_API_KEY: return False
    if not platforms: return False
    
    headers = {"Authorization": f"Bearer {AYRSHARE_API_KEY}", "Content-Type": "application/json"}
    payload = {"post": caption, "platforms": platforms}
    if image_paths: payload["mediaUrls"] = image_paths
        
    try:
        res = requests.post(AYRSHARE_URL, json=payload, headers=headers)
        res.raise_for_status()
        print(f"✅ Ayrshare success for {platforms}")
        return True
    except Exception as e:
        print(f"❌ Ayrshare failed for {platforms}: {e}")
        return False

def get_buffer_profiles():
    try:
        res = requests.get(f"{BUFFER_API_BASE}/profiles.json?access_token={BUFFER_ACCESS_TOKEN}")
        res.raise_for_status()
        return res.json()
    except: return []

def post_to_buffer(caption, image_paths=None, target_platform="facebook"):
    if not BUFFER_ACCESS_TOKEN: return False
    profiles = get_buffer_profiles()
    
    target_ids = []
    has_image = image_paths and len(image_paths) > 0
    for p in profiles:
        service = str(p.get("service", "")).lower()
        if target_platform in service:
            # Pinterest requires an image in Buffer
            if "pinterest" in service and not has_image: continue
            target_ids.append(p.get("id"))
            
    if not target_ids: return False
    
    payload = {"access_token": BUFFER_ACCESS_TOKEN, "text": caption, "profile_ids[]": target_ids}
    if has_image: payload["media[photo]"] = image_paths[0]
        
    try:
        res = requests.post(f"{BUFFER_API_BASE}/updates/create.json", data=payload)
        res.raise_for_status()
        print(f"✅ Buffer success for {target_platform}")
        return True
    except Exception as e:
        print(f"❌ Buffer failed for {target_platform}: {e}")
        return False

def post_everywhere(captions_dict, image_paths=None, selected_platforms=None):
    """
    captions_dict is a dictionary: {"linkedin": "...", "instagram": "...", "pinterest": "..."}
    selected_platforms is a list: ["linkedin", "pinterest"]
    """
    success = False
    
    if selected_platforms is None:
        selected_platforms = ["linkedin", "instagram", "facebook", "pinterest"]
        
    # LinkedIn via Ayrshare
    if "linkedin" in selected_platforms:
        cap = captions_dict.get("linkedin", captions_dict.get("instagram", "New Design"))
        if post_to_ayrshare(cap, image_paths, platforms=["linkedin"]): success = True
            
    # Instagram via Ayrshare
    if "instagram" in selected_platforms and (not image_paths or len(image_paths) > 0):
        cap = captions_dict.get("instagram", "New Design")
        if post_to_ayrshare(cap, image_paths, platforms=["instagram"]): success = True

    # Facebook via Buffer
    if "facebook" in selected_platforms:
        # Fallback to instagram caption for facebook if none
        cap = captions_dict.get("instagram", captions_dict.get("linkedin", "New Design"))
        if post_to_buffer(cap, image_paths, target_platform="facebook"): success = True

    # Pinterest via Buffer
    if "pinterest" in selected_platforms and image_paths and len(image_paths) > 0:
        cap = captions_dict.get("pinterest", "New Design")
        if post_to_buffer(cap, image_paths, target_platform="pinterest"): success = True

    return success
