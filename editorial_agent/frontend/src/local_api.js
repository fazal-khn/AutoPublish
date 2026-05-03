const API_BASE = 'http://localhost:8000/api';

export const getDrafts = async () => {
    try {
        const response = await fetch(`${API_BASE}/drafts`);
        return await response.json();
    } catch (e) { return []; }
};

export const getQueue = async () => {
    try {
        const response = await fetch(`${API_BASE}/queue`);
        return await response.json();
    } catch (e) { return []; }
};

export const getSchedule = async () => {
    try {
        const response = await fetch(`${API_BASE}/schedule`);
        return await response.json();
    } catch (e) { return []; }
};

export const getPostedHistory = async () => {
    try {
        const response = await fetch(`${API_BASE}/history`);
        const json = await response.json();
        return json.map(h => h.image_name);
    } catch (e) { return []; }
};

export const uploadImage = async (file) => {
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        return await response.json();
    } catch (e) { throw new Error("Upload failed"); }
};

// Instead of passing the entire array, we update individual drafts.
export const updateDraftStatus = async (draftId, draftData) => {
    try {
        const response = await fetch(`${API_BASE}/drafts/${draftId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftData)
        });
        return response.ok;
    } catch (e) { return false; }
};

export const deleteDraft = async (draftId) => {
    try {
        const response = await fetch(`${API_BASE}/drafts/${draftId}`, { method: 'DELETE' });
        return response.ok;
    } catch (e) { return false; }
};

export const triggerDraftGeneration = async (imageName = null) => {
    try {
        let url = `${API_BASE}/generate`;
        if (imageName) url += `?image_name=${encodeURIComponent(imageName)}`;
        const response = await fetch(url, { method: 'POST' });
        return await response.json();
    } catch (e) { return null; }
};

export const saveSchedule = async (scheduleArray) => {
    try {
        const response = await fetch(`${API_BASE}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleArray)
        });
        return response.ok;
    } catch (e) { return false; }
};

export const engageComment = async (data) => {
    try {
        const response = await fetch(`${API_BASE}/engage/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) { return { response: "Error reaching AI" }; }
};

export const analyzeCrisis = async (data) => {
    try {
        const response = await fetch(`${API_BASE}/crisis/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) { return { severity_level: "minor", recommended_action: "Error" }; }
};

export const researchHashtags = async (data) => {
    try {
        const response = await fetch(`${API_BASE}/research/hashtags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) { return { primary_hashtags: ["#error"] }; }
};

export const analyzePerformance = async (data) => {
    try {
        const response = await fetch(`${API_BASE}/analytics/performance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) { return { summary: "Error analyzing" }; }
};
