from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from parser import EDIParser
from validator import EDIValidator
from summarizer import EDISummarizer
from chat import EDIChatBot

app = FastAPI(title="EDI Parser API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = EDIParser()
validator = EDIValidator()
summarizer = EDISummarizer()
chatbot = EDIChatBot()

# In-memory store for current session
session_store = {}

class ChatRequest(BaseModel):
    question: str
    session_id: str

class FixRequest(BaseModel):
    session_id: str
    segment: str
    element: str
    suggested_value: str
    error_index: int

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        raw = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot read file")

    meta = parser.detect_transaction(raw)
    if not meta:
        raise HTTPException(status_code=400, detail="Not a valid X12 EDI file")

    session_id = meta["session_id"]
    session_store[session_id] = {"raw": raw, "meta": meta}

    return {"session_id": session_id, "metadata": meta}


@app.get("/parse/{session_id}")
async def parse_file(session_id: str):
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    raw = session_store[session_id]["raw"]
    meta = session_store[session_id]["meta"]
    parsed = parser.parse(raw, meta["transaction_type"])
    session_store[session_id]["parsed"] = parsed
    return {"parsed": parsed}


@app.get("/validate/{session_id}")
async def validate_file(session_id: str):
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    if "parsed" not in session_store[session_id]:
        raw = session_store[session_id]["raw"]
        meta = session_store[session_id]["meta"]
        session_store[session_id]["parsed"] = parser.parse(raw, meta["transaction_type"])

    parsed = session_store[session_id]["parsed"]
    tx_type = session_store[session_id]["meta"]["transaction_type"]
    errors = validator.validate(parsed, tx_type)
    session_store[session_id]["errors"] = errors
    return {"errors": errors, "error_count": len(errors), "warning_count": sum(1 for e in errors if e["severity"] == "warning")}


@app.get("/summary/{session_id}")
async def get_summary(session_id: str):
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    if "parsed" not in session_store[session_id]:
        raw = session_store[session_id]["raw"]
        meta = session_store[session_id]["meta"]
        session_store[session_id]["parsed"] = parser.parse(raw, meta["transaction_type"])

    parsed = session_store[session_id]["parsed"]
    tx_type = session_store[session_id]["meta"]["transaction_type"]
    summary = summarizer.summarize(parsed, tx_type)
    return {"summary": summary, "transaction_type": tx_type}


@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    store = session_store[req.session_id]
    parsed = store.get("parsed", {})
    errors = store.get("errors", [])
    meta = store.get("meta", {})
    answer = await chatbot.ask(req.question, parsed, errors, meta)
    return {"answer": answer}


@app.post("/fix")
async def fix_error(req: FixRequest):
    if req.session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    store = session_store[req.session_id]
    parsed = store.get("parsed", {})
    tx_type = store["meta"]["transaction_type"]

    # Apply fix to parsed structure
    fixed_parsed = parser.apply_fix(parsed, req.segment, req.element, req.suggested_value)
    session_store[req.session_id]["parsed"] = fixed_parsed

    # Re-validate
    errors = validator.validate(fixed_parsed, tx_type)
    session_store[req.session_id]["errors"] = errors

    return {
        "success": True,
        "parsed": fixed_parsed,
        "errors": errors,
        "message": f"Fixed {req.segment} {req.element} → {req.suggested_value}"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)