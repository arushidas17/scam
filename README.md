# Fraud Guardian

Fraud Guardian detects suspicious invoices and payment requests using rule-based risk scoring and AI-assisted invoice extraction.

## Features
- Invoice upload and AI-powered data extraction
- Detection of duplicate invoices, bank changes and lookalike domains
- Payment email analysis
- Risk scores, evidence and recommendations
- Vendor management and review decisions

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** FastAPI, Python
- **Database:** PostgreSQL
- **Services:** Supabase, Google Gemini

## Setup

**Backend**
```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Frontend** (in a separate terminal)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Configure the environment variables in both `.env` files before running the application.

## Note
Risk scores assist human review and do not guarantee that an invoice is fraudulent or safe.
