import os
import json
import httpx
from typing import Any, Dict, List


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-2.5-flash"

SYSTEM_CONTEXT = """You are an expert US healthcare EDI (Electronic Data Interchange) specialist with deep knowledge of:
- X12 837P and 837I (professional and institutional medical claims)
- X12 835 (Electronic Remittance Advice / payment explanation)
- X12 834 (Benefit Enrollment and Maintenance)
- HIPAA 5010 implementation guides
- ICD-10 diagnosis codes, CPT/HCPCS procedure codes
- CARC/RARC adjustment reason codes
- NPI validation (Luhn algorithm)
- CMS billing rules and payer requirements

You are analyzing a specific EDI file. Answer questions about THIS file using the provided parsed data and validation errors. Be specific — mention actual segment names, element positions, claim IDs, and values from the file. If the answer requires data not in the parsed file, say so clearly.

Keep answers concise but technically accurate. Use plain language that a medical billing specialist would understand."""


class EDIChatBot:
    async def ask(self, question: str, parsed: dict, errors: List[dict], meta: dict) -> str:
        if not GEMINI_API_KEY:
            return self._fallback_answer(question, parsed, errors, meta)

        # Build context from file data
        tx_type = meta.get("transaction_type", "Unknown")
        claims = parsed.get("claims", [])
        members = parsed.get("members", [])
        error_count = len([e for e in errors if e.get("severity") == "error"])
        warning_count = len([e for e in errors if e.get("severity") == "warning"])

        context_parts = [
            f"TRANSACTION TYPE: {tx_type}",
            f"SENDER: {meta.get('sender_id', 'Unknown')} → RECEIVER: {meta.get('receiver_id', 'Unknown')}",
            f"DATE: {meta.get('interchange_date', 'Unknown')}",
            f"VALIDATION: {error_count} errors, {warning_count} warnings",
        ]

        if claims:
            context_parts.append(f"\nCLAIMS ({len(claims)} total):")
            for c in claims[:5]:  # limit to 5 claims for context
                context_parts.append(
                    f"  - Claim {c.get('claim_id','?')}: "
                    f"${c.get('total_charge','?')} billed, "
                    f"date={c.get('service_date','?')}, "
                    f"facility={c.get('facility_type','?')}, "
                    f"diagnoses={[d.get('code') for d in c.get('diagnoses',[])]}"
                )

        if members:
            context_parts.append(f"\nMEMBERS ({len(members)} total):")
            for m in members[:5]:
                context_parts.append(
                    f"  - {m.get('name','?')} | ID:{m.get('subscriber_id','?')} | "
                    f"Type:{m.get('maintenance_label','?')} | DOB:{m.get('dob','?')}"
                )

        if errors:
            context_parts.append(f"\nVALIDATION ERRORS:")
            for e in errors[:10]:
                context_parts.append(
                    f"  [{e.get('severity','?').upper()}] {e.get('segment','?')} {e.get('element','?')}: "
                    f"{e.get('message','?')}"
                )

        file_context = "\n".join(context_parts)

        prompt = f"""{SYSTEM_CONTEXT}

=== FILE CONTEXT ===
{file_context}

=== USER QUESTION ===
{question}

Provide a clear, specific answer based on the file context above."""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_API_KEY}"
                response = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3,
                            "maxOutputTokens": 1024,
                        }
                    }
                )
                data = response.json()
                if "candidates" in data and data["candidates"]:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                elif "error" in data:
                    return f"API error: {data['error'].get('message', 'Unknown error')}. " + self._fallback_answer(question, parsed, errors, meta)
                return self._fallback_answer(question, parsed, errors, meta)
        except Exception as e:
            return self._fallback_answer(question, parsed, errors, meta)

    def _fallback_answer(self, question: str, parsed: dict, errors: list, meta: dict) -> str:
        """Rule-based fallback when no API key."""
        q = question.lower()
        tx = meta.get("transaction_type", "")
        claims = parsed.get("claims", [])
        members = parsed.get("members", [])

        if any(w in q for w in ["error", "wrong", "issue", "problem", "reject", "fail"]):
            if not errors:
                return "No validation errors were found in this file. It appears to be well-formed."
            parts = [f"This file has {len(errors)} validation issue(s):"]
            for e in errors[:5]:
                parts.append(f"• **{e['segment']} {e['element']}**: {e['message']}")
                parts.append(f"  → {e['explanation']}")
            if len(errors) > 5:
                parts.append(f"...and {len(errors)-5} more. See the Error Panel for full details.")
            return "\n".join(parts)

        elif any(w in q for w in ["claim", "clm", "charge", "amount", "billed"]):
            if not claims:
                return "No claims were found in this file."
            c = claims[0]
            return (f"This file contains {len(claims)} claim(s). "
                    f"Claim {c.get('claim_id','?')} has a total charge of ${c.get('total_charge','?')} "
                    f"with {len(c.get('service_lines',[]))} service line(s) and "
                    f"{len(c.get('diagnoses',[]))} diagnosis code(s).")

        elif any(w in q for w in ["member", "enrollment", "ins", "834"]):
            if not members:
                return "No member records were found in this file."
            adds = sum(1 for m in members if m.get("maintenance_type") == "021")
            terms = sum(1 for m in members if m.get("maintenance_type") == "024")
            return (f"This 834 file contains {len(members)} member record(s): "
                    f"{adds} addition(s) and {terms} termination(s).")

        elif any(w in q for w in ["npi", "provider", "billing"]):
            bp = parsed.get("billing_provider", {})
            return (f"The billing provider is '{bp.get('name', 'Unknown')}' "
                    f"with NPI: {bp.get('npi', 'Not found')}. "
                    f"NPIs must be 10 digits and pass the Luhn algorithm check.")

        elif any(w in q for w in ["835", "payment", "remittance", "paid", "denied"]):
            if tx == "835":
                claims_835 = parsed.get("claims", [])
                denied = sum(1 for c in claims_835 if float(c.get("paid_amount","0") or "0") == 0)
                return (f"This 835 remittance has {len(claims_835)} claim(s), "
                        f"{denied} of which were denied (paid $0). "
                        f"Check the CAS segments for adjustment reason codes explaining each denial.")

        elif any(w in q for w in ["what is", "explain", "mean", "define"]):
            for term, explanation in [
                ("837", "An 837 is a healthcare claim file submitted by a provider to an insurance payer. 837P is for professional claims (office visits), 837I for institutional claims (hospital stays)."),
                ("835", "An 835 is an Electronic Remittance Advice — the payer's response after processing a claim, showing what was paid, adjusted, or denied and why."),
                ("834", "An 834 is a Benefit Enrollment file used by employers and brokers to add, change, or terminate member health plan coverage."),
                ("npi", "An NPI (National Provider Identifier) is a unique 10-digit number assigned to healthcare providers. It must pass the Luhn checksum algorithm."),
                ("carc", "CARC stands for Claim Adjustment Reason Code — a standardized code in the 835 that explains why a claim was adjusted or denied."),
                ("isa", "ISA is the Interchange Control Header — the outermost envelope of an X12 EDI file identifying the sender and receiver."),
                ("clm", "The CLM segment is the claim header in an 837 file. CLM01 is the claim ID, CLM02 is the total billed amount, CLM05 contains facility type and claim frequency codes."),
                ("icd", "ICD-10 codes are diagnosis codes (e.g., J18.9 for pneumonia). They establish medical necessity and are required in the HI segment of every 837 claim."),
            ]:
                if term in q:
                    return explanation

        return (f"I'm analyzing your {tx} file with {len(claims) or len(members)} record(s) and "
                f"{len(errors)} validation issue(s). Could you be more specific? For example, ask about "
                f"a specific error, claim ID, member, or X12 segment.")