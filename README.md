# EDI Parser & Validator

A comprehensive tool designed to automatically detect, parse, validate, and explain healthcare Electronic Data Interchange (EDI) files. Featuring a clean, modern user interface and an AI-powered assistant to help healthcare professionals understand complex EDI formats.

## Features

- **Multi-format Support**: Natively supports HIPAA 5010 X12 standards, including:
  - **837P**: Professional Medical Claims
  - **837I**: Institutional Medical Claims
  - **835**: Electronic Remittance Advice (Payments)
  - **834**: Benefit Enrollment and Maintenance
- **Interactive Tree View**: Visually explore the hierarchical parsed structure of complex EDI files.
- **Robust Validation**: Detects missing segments, invalid codes, NPI checksum errors, and HIPAA compliance issues with **one-click suggested fixes**.
- **Statistical Summaries**: Instantly view totals, billed claim counts, denied counts, member additions/terminations, and easy-to-read tables for each transaction type.
- **AI Chat Assistant**: Powered by **Google Gemini 2.5 Flash**, interactively ask questions about the loaded EDI file (e.g., "Why was claim 123 denied?", "What does CARC 45 mean here?").

## Tech Stack

**Frontend**
- React 18
- Vite
- TypeScript

**Backend**
- Python 3.11+
- FastAPI
- Uvicorn
- `google-generativeai` via `httpx`

## Getting Started Locally

### Prerequisites
- Node.js (for the frontend)
- Python 3.11 or higher (for the backend)
- A [Google Gemini API Key](https://aistudio.google.com/)

### 1. Setup the Backend
Open a terminal and navigate to the `backend` directory:
```bash
cd backend

# (Optional but recommended) Create a virtual environment
python -m venv venv
# Windows: venv\\Scripts\\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key
# Windows/Powershell
$env:GEMINI_API_KEY="your-api-key-here"

# On Mac/Linux, use: 
export GEMINI_API_KEY="your-api-key-here"

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```
The backend will be running at `http://localhost:8000`.

### 2. Setup the Frontend
Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
The frontend will be running at `http://localhost:5173`
