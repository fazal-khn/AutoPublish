from flask import Flask, jsonify
import asyncio
import os
from main import main as run_agent

app = Flask(__name__)

@app.route('/')
def home():
    return "Editorial Agent is Online. Visit /trigger to start a post."

@app.route('/trigger')
def trigger():
    """
    This endpoint wakes up the agent and starts a batch post.
    """
    try:
        # Run the main agent logic
        asyncio.run(run_agent())
        return jsonify({"status": "success", "message": "Batch post triggered successfully!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    # Render provides a PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
