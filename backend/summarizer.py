from typing import Any, Dict


class EDISummarizer:
    def summarize(self, parsed: dict, tx_type: str) -> Dict[str, Any]:
        if tx_type == "835":
            return self._summarize_835(parsed)
        elif tx_type == "834":
            return self._summarize_834(parsed)
        elif tx_type in ("837P", "837I"):
            return self._summarize_837(parsed)
        return {}

    def _summarize_837(self, parsed: dict) -> dict:
        claims = parsed.get("claims", [])
        total_billed = 0.0
        for c in claims:
            try:
                total_billed += float(c.get("total_charge", "0") or "0")
            except ValueError:
                pass
        return {
            "type": "837",
            "claim_count": len(claims),
            "total_billed": round(total_billed, 2),
            "billing_provider": parsed.get("billing_provider", {}).get("name", ""),
            "claims": [
                {
                    "claim_id": c.get("claim_id", ""),
                    "total_charge": c.get("total_charge", ""),
                    "service_date": c.get("service_date", ""),
                    "facility_type": c.get("facility_type", ""),
                    "service_count": len(c.get("service_lines", [])),
                    "diagnoses": [d.get("code") for d in c.get("diagnoses", [])],
                }
                for c in claims
            ]
        }

    def _summarize_835(self, parsed: dict) -> dict:
        claims = parsed.get("claims", [])
        total_billed = 0.0
        total_paid = 0.0
        total_patient = 0.0
        denied = 0
        paid_full = 0
        partial = 0

        for c in claims:
            try:
                b = float(c.get("billed_amount", "0") or "0")
                p = float(c.get("paid_amount", "0") or "0")
                pr = float(c.get("patient_responsibility", "0") or "0")
                total_billed += b
                total_paid += p
                total_patient += pr
                if p == 0:
                    denied += 1
                elif abs(b - p) < 0.01:
                    paid_full += 1
                else:
                    partial += 1
            except (ValueError, TypeError):
                partial += 1

        carc_explanations = {
            "1": "Deductible amount",
            "2": "Coinsurance amount",
            "3": "Co-payment amount",
            "4": "The service/equipment is not covered",
            "5": "The procedure/service is inconsistent with the modifier",
            "16": "Claim/service lacks information — resubmit with required fields",
            "18": "Duplicate claim/service",
            "22": "This service has been paid by another payer",
            "26": "Expenses incurred prior to coverage",
            "27": "Expenses incurred after coverage terminated",
            "45": "Charges exceed your contracted/legislated fee arrangement",
            "97": "Payment included in allowance for another service",
            "100": "Payment made to patient/insured",
            "109": "Claim not covered by this payer/contractor",
            "CO-45": "Contractual adjustment — provider write-off per contract",
            "PR-1": "Patient deductible responsibility",
            "PR-2": "Patient coinsurance responsibility",
            "PR-3": "Patient copayment responsibility",
        }

        summary_claims = []
        for c in claims:
            adjs = c.get("adjustments", [])
            adj_details = []
            for a in adjs:
                carc = a.get("reason_code", "")
                group = a.get("group_code", "")
                key = f"{group}-{carc}" if group else carc
                adj_details.append({
                    "group": group,
                    "group_label": a.get("group_label", group),
                    "carc": carc,
                    "amount": a.get("amount", ""),
                    "explanation": carc_explanations.get(key, carc_explanations.get(carc, f"Adjustment reason code {carc}"))
                })

            try:
                b = float(c.get("billed_amount", "0") or "0")
                p = float(c.get("paid_amount", "0") or "0")
                if p == 0:
                    status = "denied"
                elif abs(b - p) < 0.01:
                    status = "paid_full"
                else:
                    status = "partial"
            except (ValueError, TypeError):
                status = "partial"

            summary_claims.append({
                "claim_id": c.get("claim_id", ""),
                "patient_name": c.get("patient_name", c.get("subscriber_name", "")),
                "payer_icn": c.get("payer_icn", ""),
                "billed": c.get("billed_amount", ""),
                "paid": c.get("paid_amount", ""),
                "patient_responsibility": c.get("patient_responsibility", ""),
                "status": status,
                "status_label": c.get("status", ""),
                "adjustments": adj_details,
            })

        return {
            "type": "835",
            "payer": parsed.get("payer", {}).get("name", ""),
            "payee": parsed.get("payee", {}).get("name", ""),
            "check_number": parsed.get("check_info", {}).get("check_number", ""),
            "payment_date": parsed.get("check_info", {}).get("payment_date", ""),
            "total_payment": parsed.get("check_info", {}).get("amount", ""),
            "stats": {
                "total_claims": len(claims),
                "paid_full": paid_full,
                "partial": partial,
                "denied": denied,
                "total_billed": round(total_billed, 2),
                "total_paid": round(total_paid, 2),
                "total_patient_responsibility": round(total_patient, 2),
            },
            "claims": summary_claims,
        }

    def _summarize_834(self, parsed: dict) -> dict:
        members = parsed.get("members", [])
        additions = sum(1 for m in members if m.get("maintenance_type") == "021")
        changes = sum(1 for m in members if m.get("maintenance_type") == "001")
        terminations = sum(1 for m in members if m.get("maintenance_type") == "024")
        other = len(members) - additions - changes - terminations

        member_rows = []
        for m in members:
            mtype = m.get("maintenance_type", "")
            status = "addition" if mtype == "021" else "termination" if mtype == "024" else "change" if mtype == "001" else "other"
            member_rows.append({
                "name": m.get("name", "Unknown"),
                "subscriber_id": m.get("subscriber_id", ""),
                "dob": m.get("dob", ""),
                "gender": m.get("gender", ""),
                "relationship": m.get("relationship", ""),
                "maintenance_type": mtype,
                "maintenance_label": m.get("maintenance_label", mtype),
                "status": status,
                "coverage_begin": m.get("coverage_begin", ""),
                "coverage_end": m.get("coverage_end", ""),
                "group_number": m.get("group_number", ""),
                "coverage_plans": [c.get("plan_description", c.get("insurance_line", "")) for c in m.get("coverage", [])],
            })

        return {
            "type": "834",
            "sponsor": parsed.get("sponsor", {}).get("name", ""),
            "insurer": parsed.get("sponsor", {}).get("insurer", ""),
            "stats": {
                "total_members": len(members),
                "additions": additions,
                "changes": changes,
                "terminations": terminations,
                "other": other,
            },
            "members": member_rows,
        }