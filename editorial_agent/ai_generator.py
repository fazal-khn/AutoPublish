import os
import json
import requests
import uuid
import urllib.parse
import urllib.request
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from PIL import Image

load_dotenv()

PORTFOLIO_DIR = Path(__file__).parent / "portfolio"
VOICE_FILE = Path(__file__).parent / "brand_voice.txt"

# Ensure portfolio dir exists
PORTFOLIO_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    vision_model = genai.GenerativeModel('gemini-1.5-flash')
    editor_model = genai.GenerativeModel('gemini-1.5-pro-latest')
else:
    vision_model = None
    editor_model = None

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def get_hacker_news_trends():
    try:
        top_ids = requests.get("https://hacker-news.firebaseio.com/v0/topstories.json", timeout=5).json()[:5]
        trends = []
        for item_id in top_ids:
            story = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json", timeout=5).json()
            if story and 'title' in story:
                trends.append(story['title'])
        return " | ".join(trends)
    except:
        return "AI and Design Automation"

def read_brand_voice():
    if VOICE_FILE.exists():
        with open(VOICE_FILE, "r") as f:
            return f.read()
    return "You are an elite Social Media Strategist."

def generate_image_from_scratch(image_prompt):
    """Uses Pollinations.ai to generate a free image."""
    print("🎨 Requesting image from Pollinations.ai...")
    try:
        encoded_prompt = urllib.parse.quote(image_prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1080&height=1080&nologo=true"
        filename = f"ai_gen_{uuid.uuid4().hex[:8]}.jpg"
        filepath = PORTFOLIO_DIR / filename
        urllib.request.urlretrieve(url, filepath)
        print(f"✅ Image generated and saved as {filename}")
        return filename
    except Exception as e:
        print(f"Image generation failed: {e}")
        return None

def agent_1_vision_analyst(image_path):
    if not vision_model or not image_path or not image_path.exists(): 
        return "No specific image provided. We need an original concept based on daily trends."
    try:
        print("👁️ Agent 1 (Vision): Analyzing pixels...")
        img = Image.open(image_path)
        prompt = "You are a Master Art Director. Output a highly technical analysis of this image's grid structure, typography, negative space, and aesthetic mood."
        res = vision_model.generate_content([prompt, img])
        return res.text
    except Exception as e:
        return "A beautiful design."

def agent_2_creative_variations(design_analysis, trends, voice):
    if not OPENROUTER_API_KEY: return None
    print("✍️ Agent 2 (Creative): Executing $20K Strategy...")
    
    prompt = f"""
    You are an elite social media strategist and growth hacker with 15 years of experience.
    
    BRAND VOICE:
    {voice}
    
    DAILY TRENDS:
    {trends}
    
    DESIGN ANALYSIS:
    {design_analysis}
    
    TASK: Brainstorm 3 distinct viral concepts for this design.
    - Concept 1: Educational (Tips/Insights)
    - Concept 2: Engaging (Questions/Polls/Storytelling)
    - Concept 3: Inspirational (Motivation/Behind-the-scenes)
    
    For each concept, write the LinkedIn, Instagram, and Pinterest captions following these strict rules:
    - LinkedIn: 150-300 words, professional hook, line breaks, max 2 emojis, 5-7 hashtags.
    - Instagram: Visual storytelling, short paragraphs, bold hook, 10-15 research-backed hashtags, CTA to save/share.
    - Pinterest: Keyword-dense, value proposition upfront, 3-5 hashtags.
    
    Return EXACTLY a JSON array of 3 objects: [{{"linkedin": "...", "instagram": "...", "pinterest": "..."}}, ...]
    """
    
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "meta-llama/llama-3-8b-instruct:free",
        "messages": [{"role": "user", "content": prompt}]
    }
    try:
        res = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        res.raise_for_status()
        text = res.json()['choices'][0]['message']['content']
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except:
        return None

def agent_3_chief_editor(variations_json, voice, needs_image=False):
    if not editor_model or not variations_json: return None
    print("⚖️ Agent 3 (Editor): Refining JSON Masterpiece...")
    
    img_prompt_instruction = ""
    if needs_image:
        img_prompt_instruction = "Since we don't have an image, you MUST also include an 'image_prompt' key with a highly detailed prompt (minimum 40 words) for an AI image generator to create the visual for this post."
    
    prompt = f"""
    Brand Voice Rules:
    {voice}
    
    Here are 3 creative variations:
    {json.dumps(variations_json, indent=2)}
    
    TASK: Act as the ruthless Chief Editor.
    1. Select the best LinkedIn post, best Instagram post, and best Pinterest post.
    2. Eliminate anything cliché, robotic, or spammy.
    3. Ensure hashtag mathematics are perfect (mix of broad and niche).
    
    OUTPUT:
    Output a single RAW JSON object with EXACTLY these keys: 'linkedin', 'instagram', 'pinterest'.
    {img_prompt_instruction}
    """
    try:
        res = editor_model.generate_content(prompt)
        text = res.text
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except:
        return None

def generate_caption(image_filename=None):
    voice = read_brand_voice()
    trends = get_hacker_news_trends()
    
    img_path = PORTFOLIO_DIR / image_filename if image_filename else None
    
    # 1. Vision Analyst
    analysis = agent_1_vision_analyst(img_path)
    
    # 2. Creative Variations
    variations = agent_2_creative_variations(analysis, trends, voice)
    
    final_json = None
    if variations:
        # 3. Chief Editor
        final_json = agent_3_chief_editor(variations, voice, needs_image=(image_filename is None))
    
    # Fallback to direct prompt if agents fail
    if not final_json and OPENROUTER_API_KEY:
        try:
            print("⚠️ Falling back to simple JSON generation...")
            prompt = f"Voice: {voice}\nTrends: {trends}\nGenerate a JSON object with 'linkedin', 'instagram', 'pinterest' captions, and an 'image_prompt' string describing a visual."
            res = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}, json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": [{"role": "user", "content": prompt}]})
            text = res.json()['choices'][0]['message']['content']
            if "```json" in text: text = text.split("```json")[1].split("```")[0]
            final_json = json.loads(text.strip())
        except: pass

    if not final_json:
        final_json = {
            "linkedin": "Exploring new boundaries in design. #Design",
            "instagram": "Minimalism is key. 🔲 #Design",
            "pinterest": "Modern layout featuring strict grid systems.",
            "image_prompt": "A highly professional, minimalist editorial design layout featuring beautiful typography and negative space."
        }

    # If no image was provided, generate one using the AI's prompt!
    if not image_filename and "image_prompt" in final_json:
        generated_filename = generate_image_from_scratch(final_json["image_prompt"])
        if generated_filename:
            return generated_filename, final_json

    return image_filename, final_json

def generate_comment_response(platform, post_content, commenter_name, comment_text, sentiment):
    if not OPENROUTER_API_KEY: return "Thanks for the comment!"
    voice = read_brand_voice()
    prompt = f"""
    SYSTEM: You are a professional social media community manager.
    
    Platform: {platform}
    Original Post: {post_content}
    Comment from {commenter_name}: "{comment_text}"
    Comment Sentiment: {sentiment}
    
    Generate a response that:
    1. Acknowledges their comment specifically (use their name)
    2. Adds value (answer question, provide insight, share resource)
    3. Encourages continued conversation
    4. Matches brand voice: {voice}
    5. Is 1-3 sentences maximum
    6. Feels human, not robotic
    
    If sentiment is negative, offer to move to DM. Stay professional.
    Return ONLY the response text.
    """
    try:
        res = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}, json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": [{"role": "user", "content": prompt}]})
        return res.json()['choices'][0]['message']['content'].strip()
    except: return "Thanks for sharing!"

def analyze_crisis(alert_type, incident_details, sentiment_percentage, platforms):
    if not OPENROUTER_API_KEY: return {"severity_level": "minor", "recommended_action": "Monitor"}
    prompt = f"""
    SYSTEM: You are a crisis management specialist for social media.
    
    Alert Triggered: {alert_type}
    Details: {incident_details}
    Sentiment Analysis: {sentiment_percentage}% Negative
    Affected Platforms: {platforms}
    
    Return JSON:
    {{
      "severity_level": "minor|moderate|severe",
      "recommended_action": "Action plan",
      "public_response": "Draft response or null",
      "internal_alert": "Message to human team",
      "monitoring_plan": "What to watch next"
    }}
    """
    try:
        res = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}, json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": [{"role": "user", "content": prompt}]})
        text = res.json()['choices'][0]['message']['content']
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except: return {"severity_level": "minor", "recommended_action": "Monitor"}

def research_hashtags(platform, topic, audience, industry):
    if not OPENROUTER_API_KEY: return {"primary_hashtags": ["#marketing"], "branded_hashtag": "#Brand"}
    prompt = f"""
    SYSTEM: You are a hashtag research expert.
    
    Platform: {platform}
    Content Topic: {topic}
    Target Audience: {audience}
    Industry: {industry}
    
    Return JSON:
    {{
      "primary_hashtags": ["tag1", "tag2"],
      "secondary_hashtags": ["tag3", "tag4"],
      "branded_hashtag": "#BrandCampaign",
      "strategy_note": "Why these work"
    }}
    """
    try:
        res = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}, json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": [{"role": "user", "content": prompt}]})
        text = res.json()['choices'][0]['message']['content']
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except: return {"primary_hashtags": ["#marketing"], "branded_hashtag": "#Brand"}

def analyze_performance(start_date, end_date, metrics_json, goals_json):
    if not OPENROUTER_API_KEY: return {"summary": "Great job!", "insights": ["Keep posting"]}
    prompt = f"""
    SYSTEM: You are a data analyst specializing in social media analytics. You turn raw data into actionable insights.
    
    Time Period: {start_date} to {end_date}
    Platform Data: {metrics_json}
    Goals: {goals_json}
    
    ANALYZE:
    1. Performance vs Goals
    2. Top/Bottom Performing Content
    3. Audience Growth Trends
    
    Return JSON report:
    {{
      "summary": "Executive summary",
      "key_metrics": {{"growth": "...", "engagement": "..."}},
      "insights": ["insight 1", "insight 2"],
      "recommendations": ["rec 1", "rec 2"],
      "action_items": ["action 1", "action 2"]
    }}
    """
    try:
        res = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}, json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": [{"role": "user", "content": prompt}]})
        text = res.json()['choices'][0]['message']['content']
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except: return {"summary": "Error analyzing data"}

if __name__ == "__main__":
    img, caps = generate_caption(None)
    print(f"Image: {img}")
    print(json.dumps(caps, indent=2))
