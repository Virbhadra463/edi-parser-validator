import re
import uuid
from typing import Optional


class EDIParser:
    def detect_transaction(self, raw: str) -> Optional[dict]:
        """Detect ISA/GS/ST and return metadata."""
        # Normalize line endings
        raw = raw.replace("\n", "").replace("\r", "")

        # Find segment terminator - typically ~ but detect it
        seg_term = "~"
        if "ISA" in raw:
            isa_start = raw.index("ISA")
            # Element separator is always the 4th char of ISA (position 3)
            elem_sep = raw[isa_start + 3]
            # Split ISA into elements; ISA has 16 elements after the tag.
            # The segment terminator immediately follows ISA16 (1 char).
            isa_elements = raw[isa_start:].split(elem_sep, 17)  # ISA + 16 elements = 17 splits
            if len(isa_elements) >= 17:
                # ISA16 is the component element separator (1 char)
                # The segment terminator is the character right after ISA16
                isa16_and_rest = isa_elements[16]
                if len(isa16_and_rest) >= 2:
                    seg_term = isa16_and_rest[1]  # char after the 1-char ISA16 value

        segments = [s.strip() for s in raw.split(seg_term) if s.strip()]

        isa = None
        gs = None
        st = None

        for seg in segments:
            els = seg.split("*")
            if els[0] == "ISA" and len(els) >= 16:
                isa = els
            elif els[0] == "GS" and len(els) >= 9:
                gs = els
            elif els[0] == "ST" and len(els) >= 3:
                st = els
                break

        if not isa:
            return None

        # Determine transaction type
        tx_type = "UNKNOWN"
        if st:
            st_code = st[1] if len(st) > 1 else ""
            if st_code == "837":
                # Check GS08 or loop for 837P vs 837I
                tx_type = "837P"  # default professional
                # Look for CLM05 facility type
                for seg in segments:
                    els = seg.split("*")
                    if els[0] == "CLM" and len(els) >= 6:
                        facility = els[5].split(":")[0] if ":" in els[5] else els[5]
                        if facility in ["11", "21", "22", "23"]:
                            tx_type = "837I"
                        break
            elif st_code == "835":
                tx_type = "835"
            elif st_code == "834":
                tx_type = "834"

        session_id = str(uuid.uuid4())[:8]

        return {
            "session_id": session_id,
            "transaction_type": tx_type,
            "sender_id": isa[6].strip() if len(isa) > 6 else "",
            "receiver_id": isa[8].strip() if len(isa) > 8 else "",
            "interchange_date": isa[9] if len(isa) > 9 else "",
            "interchange_time": isa[10] if len(isa) > 10 else "",
            "interchange_control": isa[13] if len(isa) > 13 else "",
            "gs_functional_group": gs[1] if gs and len(gs) > 1 else "",
            "gs_sender": gs[2].strip() if gs and len(gs) > 2 else "",
            "gs_receiver": gs[3].strip() if gs and len(gs) > 3 else "",
            "st_transaction_set": st[1] if st and len(st) > 1 else "",
            "segment_terminator": seg_term,
            "total_segments": len(segments),
        }

    def _split_segments(self, raw: str, seg_term: str = "~") -> list:
        raw = raw.replace("\n", "").replace("\r", "")
        return [s.strip() for s in raw.split(seg_term) if s.strip()]

    def parse(self, raw: str, tx_type: str) -> dict:
        """Parse EDI into structured JSON based on transaction type."""
        if tx_type in ("837P", "837I"):
            return self._parse_837(raw)
        elif tx_type == "835":
            return self._parse_835(raw)
        elif tx_type == "834":
            return self._parse_834(raw)
        return {"raw_segments": self._split_segments(raw)}

    def _parse_837(self, raw: str) -> dict:
        segments = self._split_segments(raw)
        result = {
            "envelope": {},
            "submitter": {},
            "receiver": {},
            "billing_provider": {},
            "subscribers": [],
            "claims": [],
            "raw_segments": []
        }

        current_subscriber = None
        current_claim = None
        current_services = []
        loop = None

        for seg in segments:
            els = seg.split("*")
            tag = els[0]
            result["raw_segments"].append({"tag": tag, "elements": els[1:], "raw": seg})

            if tag == "ISA":
                result["envelope"]["ISA"] = {
                    "auth_info_qualifier": els[1] if len(els) > 1 else "",
                    "auth_info": els[2] if len(els) > 2 else "",
                    "sender_qualifier": els[5] if len(els) > 5 else "",
                    "sender_id": els[6].strip() if len(els) > 6 else "",
                    "receiver_qualifier": els[7] if len(els) > 7 else "",
                    "receiver_id": els[8].strip() if len(els) > 8 else "",
                    "date": els[9] if len(els) > 9 else "",
                    "time": els[10] if len(els) > 10 else "",
                    "control_number": els[13] if len(els) > 13 else "",
                }

            elif tag == "NM1":
                entity_id = els[1] if len(els) > 1 else ""
                name = f"{els[3]} {els[4]}".strip() if len(els) > 4 else els[3] if len(els) > 3 else ""
                npi = els[9] if len(els) > 9 else ""
                id_code = els[8] if len(els) > 8 else ""

                if entity_id == "41":  # Submitter
                    result["submitter"] = {"name": name, "id_qualifier": id_code, "id": npi}
                    loop = "submitter"
                elif entity_id == "40":  # Receiver
                    result["receiver"] = {"name": name}
                    loop = "receiver"
                elif entity_id == "85":  # Billing Provider
                    result["billing_provider"] = {"name": name, "npi": npi}
                    loop = "billing_provider"
                elif entity_id == "IL":  # Subscriber
                    if current_claim and current_services:
                        current_claim["service_lines"] = current_services
                        current_services = []
                    current_subscriber = {
                        "name": name,
                        "member_id": npi,
                        "id_qualifier": id_code
                    }
                    loop = "subscriber"
                elif entity_id == "QC":  # Patient
                    if current_subscriber:
                        current_subscriber["patient"] = {"name": name}
                    loop = "patient"
                elif entity_id == "82":  # Rendering Provider
                    if current_claim:
                        current_claim["rendering_provider"] = {"name": name, "npi": npi}

            elif tag == "DMG" and loop in ("subscriber", "patient"):
                dob = els[2] if len(els) > 2 else ""
                gender = els[3] if len(els) > 3 else ""
                if current_subscriber:
                    if loop == "patient":
                        current_subscriber.setdefault("patient", {}).update({"dob": dob, "gender": gender})
                    else:
                        current_subscriber.update({"dob": dob, "gender": gender})

            elif tag == "CLM":
                if current_claim:
                    current_claim["service_lines"] = current_services
                    current_services = []
                    if current_subscriber:
                        current_subscriber.setdefault("claims", []).append(current_claim)
                    result["claims"].append(current_claim)

                clm05 = els[5] if len(els) > 5 else ""
                parts = clm05.split(":")
                current_claim = {
                    "claim_id": els[1] if len(els) > 1 else "",
                    "total_charge": els[2] if len(els) > 2 else "",
                    "facility_type": parts[0] if parts else "",
                    "claim_frequency": parts[2] if len(parts) > 2 else "",
                    "assignment_of_benefits": els[6] if len(els) > 6 else "",
                    "provider_signature": els[7] if len(els) > 7 else "",
                    "service_lines": [],
                    "diagnoses": [],
                }
                loop = "claim"

            elif tag == "HI":  # Diagnosis codes
                if current_claim:
                    for i in range(1, len(els)):
                        code_pair = els[i].split(":")
                        if len(code_pair) >= 2:
                            current_claim["diagnoses"].append({
                                "qualifier": code_pair[0],
                                "code": code_pair[1]
                            })

            elif tag == "DTP" and loop == "claim":
                if current_claim and els[1] == "472":
                    current_claim["service_date"] = els[3] if len(els) > 3 else ""

            elif tag == "SV1":  # Professional service line
                proc = els[1].split(":") if len(els) > 1 else []
                current_services.append({
                    "procedure_code": proc[1] if len(proc) > 1 else proc[0] if proc else "",
                    "procedure_qualifier": proc[0] if proc else "",
                    "charge": els[2] if len(els) > 2 else "",
                    "units": els[4] if len(els) > 4 else "",
                    "modifier": proc[2] if len(proc) > 2 else "",
                })

            elif tag == "SV2":  # Institutional service line
                rev_code = els[1] if len(els) > 1 else ""
                proc = els[2].split(":") if len(els) > 2 else []
                current_services.append({
                    "revenue_code": rev_code,
                    "procedure_code": proc[1] if len(proc) > 1 else "",
                    "charge": els[3] if len(els) > 3 else "",
                    "units": els[5] if len(els) > 5 else "",
                })

            elif tag == "SE":
                if current_claim:
                    current_claim["service_lines"] = current_services
                    result["claims"].append(current_claim)
                if current_subscriber:
                    result["subscribers"].append(current_subscriber)

        return result

    def _parse_835(self, raw: str) -> dict:
        segments = self._split_segments(raw)
        result = {
            "envelope": {},
            "payer": {},
            "payee": {},
            "check_info": {},
            "claims": [],
            "raw_segments": []
        }

        current_claim = None
        current_services = []

        for seg in segments:
            els = seg.split("*")
            tag = els[0]
            result["raw_segments"].append({"tag": tag, "elements": els[1:], "raw": seg})

            if tag == "N1":
                qual = els[1] if len(els) > 1 else ""
                name = els[2] if len(els) > 2 else ""
                if qual == "PR":
                    result["payer"]["name"] = name
                elif qual == "PE":
                    result["payee"]["name"] = name

            elif tag == "BPR":
                result["check_info"] = {
                    "transaction_handling": els[1] if len(els) > 1 else "",
                    "amount": els[2] if len(els) > 2 else "",
                    "credit_debit": els[3] if len(els) > 3 else "",
                    "payment_method": els[4] if len(els) > 4 else "",
                    "check_number": els[9] if len(els) > 9 else "",
                    "payment_date": els[16] if len(els) > 16 else "",
                }

            elif tag == "CLP":
                if current_claim:
                    current_claim["service_lines"] = current_services
                    result["claims"].append(current_claim)
                    current_services = []

                status_map = {
                    "1": "Processed as Primary",
                    "2": "Processed as Secondary",
                    "3": "Processed as Tertiary",
                    "4": "Denied",
                    "19": "Processed as Primary, Forwarded to Additional Payer",
                    "20": "Not Our Claim",
                    "22": "Reversal of Previous Payment",
                }
                status_code = els[2] if len(els) > 2 else ""
                current_claim = {
                    "claim_id": els[1] if len(els) > 1 else "",
                    "status_code": status_code,
                    "status": status_map.get(status_code, status_code),
                    "billed_amount": els[3] if len(els) > 3 else "",
                    "paid_amount": els[4] if len(els) > 4 else "",
                    "patient_responsibility": els[5] if len(els) > 5 else "",
                    "claim_type": els[6] if len(els) > 6 else "",
                    "payer_icn": els[7] if len(els) > 7 else "",
                    "adjustments": [],
                    "service_lines": [],
                }

            elif tag == "CAS" and current_claim:
                group = els[1] if len(els) > 1 else ""
                carc = els[2] if len(els) > 2 else ""
                amount = els[3] if len(els) > 3 else ""
                current_claim["adjustments"].append({
                    "group_code": group,
                    "group_label": {"PR": "Patient Responsibility", "CO": "Contractual Obligation", "OA": "Other Adjustment", "PI": "Payer Initiated"}.get(group, group),
                    "reason_code": carc,
                    "amount": amount
                })

            elif tag == "NM1" and current_claim:
                entity = els[1] if len(els) > 1 else ""
                name = f"{els[3]} {els[4]}".strip() if len(els) > 4 else els[3] if len(els) > 3 else ""
                if entity == "QC":
                    current_claim["patient_name"] = name
                elif entity == "IL":
                    current_claim["subscriber_name"] = name

            elif tag == "SVC" and current_claim:
                proc = els[1].split(":") if len(els) > 1 else []
                current_services.append({
                    "procedure_code": proc[1] if len(proc) > 1 else proc[0] if proc else "",
                    "billed": els[2] if len(els) > 2 else "",
                    "paid": els[3] if len(els) > 3 else "",
                    "units": els[5] if len(els) > 5 else "",
                })

            elif tag == "SE":
                if current_claim:
                    current_claim["service_lines"] = current_services
                    result["claims"].append(current_claim)

        return result

    def _parse_834(self, raw: str) -> dict:
        segments = self._split_segments(raw)
        result = {
            "envelope": {},
            "sponsor": {},
            "members": [],
            "raw_segments": []
        }

        current_member = None
        maintenance_map = {
            "001": "Change", "021": "Addition", "024": "Cancellation/Termination",
            "025": "Reinstatement", "030": "Audit/Compare", "XB": "COBRA Begin",
            "XC": "COBRA End"
        }
        rel_map = {
            "18": "Self", "01": "Spouse", "19": "Child", "34": "Other Adult",
            "G8": "Other Relationship"
        }

        for seg in segments:
            els = seg.split("*")
            tag = els[0]
            result["raw_segments"].append({"tag": tag, "elements": els[1:], "raw": seg})

            if tag == "N1":
                qual = els[1] if len(els) > 1 else ""
                name = els[2] if len(els) > 2 else ""
                if qual == "P5":
                    result["sponsor"]["name"] = name
                elif qual == "IN":
                    result["sponsor"]["insurer"] = name

            elif tag == "INS":
                if current_member:
                    result["members"].append(current_member)

                maint_code = els[3] if len(els) > 3 else ""
                rel_code = els[2] if len(els) > 2 else ""
                current_member = {
                    "subscriber_indicator": els[1] if len(els) > 1 else "",
                    "relationship_code": rel_code,
                    "relationship": rel_map.get(rel_code, rel_code),
                    "maintenance_type": maint_code,
                    "maintenance_label": maintenance_map.get(maint_code, maint_code),
                    "maintenance_reason": els[4] if len(els) > 4 else "",
                    "benefit_status": els[5] if len(els) > 5 else "",
                    "employment_status": els[8] if len(els) > 8 else "",
                    "coverage": [],
                    "dependents": [],
                }

            elif tag == "REF" and current_member:
                qual = els[1] if len(els) > 1 else ""
                val = els[2] if len(els) > 2 else ""
                if qual == "0F":
                    current_member["subscriber_id"] = val
                elif qual == "1L":
                    current_member["group_number"] = val
                elif qual == "ZZ":
                    current_member["policy_number"] = val

            elif tag == "NM1" and current_member:
                entity = els[1] if len(els) > 1 else ""
                name = f"{els[3]} {els[4]}".strip() if len(els) > 4 else els[3] if len(els) > 3 else ""
                if entity in ("IL", "74", "EI"):
                    current_member["name"] = name
                    current_member["ssn_qualifier"] = els[8] if len(els) > 8 else ""
                    current_member["ssn"] = els[9] if len(els) > 9 else ""

            elif tag == "DMG" and current_member:
                current_member["dob"] = els[2] if len(els) > 2 else ""
                current_member["gender"] = els[3] if len(els) > 3 else ""

            elif tag == "DTP" and current_member:
                qual = els[1] if len(els) > 1 else ""
                date = els[3] if len(els) > 3 else ""
                if qual == "356":
                    current_member["coverage_begin"] = date
                elif qual == "357":
                    current_member["coverage_end"] = date
                elif qual == "336":
                    current_member["employment_begin"] = date

            elif tag == "HD" and current_member:
                current_member["coverage"].append({
                    "maintenance_type": els[1] if len(els) > 1 else "",
                    "insurance_line": els[3] if len(els) > 3 else "",
                    "plan_description": els[4] if len(els) > 4 else "",
                })

            elif tag == "SE":
                if current_member:
                    result["members"].append(current_member)

        return result

    def apply_fix(self, parsed: dict, segment: str, element: str, value: str) -> dict:
        """Apply a fix to the parsed structure."""
        import copy
        fixed = copy.deepcopy(parsed)

        # Walk raw_segments and fix matching segment+element
        for raw_seg in fixed.get("raw_segments", []):
            if raw_seg["tag"] == segment:
                try:
                    el_idx = int(element.replace(segment, "")) - 1
                    if el_idx < len(raw_seg["elements"]):
                        raw_seg["elements"][el_idx] = value
                        raw_seg["raw"] = segment + "*" + "*".join(raw_seg["elements"])
                except (ValueError, IndexError):
                    pass

        # Also update high-level fields for claims
        if segment == "CLM" and "02" in element:
            for claim in fixed.get("claims", []):
                claim["total_charge"] = value

        return fixed