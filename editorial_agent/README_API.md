# 🚀 AutoPublish Enterprise API Documentation

Welcome to the AutoPublish API. This backend handles content scheduling, AI generation, and multi-platform publishing.

## 🛠 Features
- **Rate Limiting**: Protected by `slowapi` (default 5 req/min on sensitive endpoints).
- **Security**: Hardened with X-Frame-Options, CSP, and HSTS.
- **Monitoring**: Live health tracking at `/api/health`.
- **Database**: Hybrid PostgreSQL (Primary) + SQLite (Fallback).

## 📡 Endpoints

### 1. System & Health
- `GET /api/health`: Returns system status, CPU, memory, and service health.
- `GET /api/system/backup`: Exports a snapshot of the database (Rate limited).

### 2. Social Media
- `GET /api/social/connect`: Generates a secure login link via Ayrshare.
- `GET /api/analytics/summary`: Aggregated performance metrics.

### 3. Content Management
- `GET /api/drafts`: List all pending content.
- `POST /api/drafts`: Create new AI content draft.
- `POST /api/schedule`: Finalize and schedule content for publishing.

## 🔐 Security Best Practices
- All mutations require a valid `Authorization` header in production.
- Use the `/api/health` endpoint for monitoring alerts.
- Perform weekly backups using the `/api/system/backup` endpoint.

---
© 2026 AutoPublish Enterprise. All rights reserved.
