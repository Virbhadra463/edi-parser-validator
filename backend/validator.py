"""
EDI X12 HIPAA 5010 Validator
Validates parsed EDI transactions against HIPAA rules and returns structured errors.
"""
from typing import Any, Dict, List


class EDIValidator:
    """Validates parsed EDI structures against X12 HIPAA 5010 rules."""

    def validate(self, parsed: dict, tx_type: str) -> List[Dict[str, Any]]:
        errors = []
        if tx_type in ("837P", "837I"):
            errors.extend(self._validate_837(parsed, tx_type))
        elif tx_type == "835":
            errors.extend(self._validate_835(parsed))
        elif tx_type == "834":
            errors.extend(self._validate_834(parsed))
        return errors

    # ------------------------------------------------------------------ #
    # 837 Validation
    # ------------------------------------------------------------------ #
    def _validate_837(self, parsed: dict, tx_type: str) -> List[Dict[str, Any]]:
        errors = []

        # ----- Billing Provider -----
        bp = parsed.get("billing_provider", {})
        npi = bp.get("npi", "")
        if not npi:
            errors.append(self._err(
                segment="NM1", element="NM109",
                error_code="H001",
                severity="error",
                message="Billing provider NPI is missing.",
                explanation=(
                    "The billing provider NPI (NM109 in loop 2010AA) is required "
                    "for all 837 claims under HIPAA 5010."
                ),
                suggestion=None,
            ))
        elif not self._luhn_check(npi):
            errors.append(self._err(
                segment="NM1", element="NM109",
                error_code="H002",
                severity="error",
                message=f"Billing provider NPI '{npi}' fails the Luhn checksum.",
                explanation=(
                    "NPIs are 10-digit numbers that must pass the Luhn algorithm. "
                    "An invalid NPI will cause claim rejection at clearinghouse level."
                ),
                suggestion=None,
            ))

        # ----- Claims -----
        claims = parsed.get("claims", [])
        if not claims:
            errors.append(self._err(
                segment="CLM", element="CLM01",
                error_code="H003",
                severity="error",
                message="No claim (CLM) segments found in the transaction.",
                explanation=(
                    "An 837 transaction must contain at least one CLM segment "
                    "representing a healthcare claim."
                ),
                suggestion=None,
            ))

        for claim in claims:
            claim_id = claim.get("claim_id", "?")

            # CLM02 – total charge
            charge = claim.get("total_charge", "")
            if not charge:
                errors.append(self._err(
                    segment="CLM", element="CLM02",
                    error_code="H004",
                    severity="error",
                    message=f"Claim '{claim_id}': total charge amount is missing.",
                    explanation=(
                        "CLM02 (Total Claim Charge Amount) is required. "
                        "All monetary amounts must be present for claim adjudication."
                    ),
                    suggestion=None,
                ))
            else:
                try:
                    val = float(charge)
                    if val <= 0:
                        errors.append(self._err(
                            segment="CLM", element="CLM02",
                            error_code="H005",
                            severity="error",
                            message=f"Claim '{claim_id}': total charge is zero or negative ({charge}).",
                            explanation=(
                                "CLM02 must be a positive dollar amount. "
                                "A zero charge will result in immediate claim denial."
                            ),
                            suggestion=None,
                        ))
                except ValueError:
                    errors.append(self._err(
                        segment="CLM", element="CLM02",
                        error_code="H006",
                        severity="error",
                        message=f"Claim '{claim_id}': total charge '{charge}' is not a valid number.",
                        explanation="CLM02 must be a numeric dollar amount.",
                        suggestion=None,
                    ))

            # HI – diagnosis codes
            diagnoses = claim.get("diagnoses", [])
            if not diagnoses:
                errors.append(self._err(
                    segment="HI", element="HI01",
                    error_code="H007",
                    severity="error",
                    message=f"Claim '{claim_id}': no diagnosis codes (HI segment) found.",
                    explanation=(
                        "At least one ICD-10-CM diagnosis code is required in the HI segment "
                        "to establish medical necessity for every 837 claim."
                    ),
                    suggestion=None,
                ))
            else:
                for dx in diagnoses:
                    code = dx.get("code", "")
                    qualifier = dx.get("qualifier", "")
                    if qualifier not in ("ABK", "ABF", "BK", "BF", ""):
                        errors.append(self._err(
                            segment="HI", element="HI01-1",
                            error_code="H008",
                            severity="warning",
                            message=f"Claim '{claim_id}': diagnosis qualifier '{qualifier}' may be non-standard.",
                            explanation=(
                                "HIPAA 5010 requires ICD-10 qualifier ABK (primary) or ABF (additional). "
                                "ICD-9 qualifiers (BK/BF) are no longer accepted."
                            ),
                            suggestion="ABK" if qualifier.startswith("B") else None,
                        ))
                    if code and not self._valid_icd10(code):
                        errors.append(self._err(
                            segment="HI", element="HI01-2",
                            error_code="H009",
                            severity="warning",
                            message=f"Claim '{claim_id}': diagnosis code '{code}' appears malformed.",
                            explanation=(
                                "ICD-10-CM codes start with a letter followed by digits and may include a decimal. "
                                "Verify the code against the current ICD-10-CM code set."
                            ),
                            suggestion=None,
                        ))

            # SV1/SV2 – service lines
            service_lines = claim.get("service_lines", [])
            if not service_lines:
                errors.append(self._err(
                    segment="SV1", element="SV101",
                    error_code="H010",
                    severity="error",
                    message=f"Claim '{claim_id}': no service lines (SV1/SV2) found.",
                    explanation=(
                        "Every 837 claim must have at least one service line "
                        "detailing the procedures billed."
                    ),
                    suggestion=None,
                ))
            else:
                for sl in service_lines:
                    proc = sl.get("procedure_code", "")
                    charge = sl.get("charge", "")
                    if not proc:
                        errors.append(self._err(
                            segment="SV1", element="SV101",
                            error_code="H011",
                            severity="error",
                            message=f"Claim '{claim_id}': a service line is missing a procedure code.",
                            explanation="Every service line must have a CPT/HCPCS procedure code.",
                            suggestion=None,
                        ))
                    if not charge:
                        errors.append(self._err(
                            segment="SV1", element="SV102",
                            error_code="H012",
                            severity="error",
                            message=f"Claim '{claim_id}': a service line is missing the charge amount.",
                            explanation="SV102 (Line Item Charge Amount) is required on every service line.",
                            suggestion=None,
                        ))

            # DTP 472 – service date
            if not claim.get("service_date"):
                errors.append(self._err(
                    segment="DTP", element="DTP03",
                    error_code="H013",
                    severity="warning",
                    message=f"Claim '{claim_id}': service date (DTP*472) is missing.",
                    explanation=(
                        "DTP*472 (Statement Dates) is required by most payers to identify "
                        "the date(s) services were rendered."
                    ),
                    suggestion=None,
                ))

            # CLM05 – facility type for 837P
            if tx_type == "837P":
                facility = claim.get("facility_type", "")
                valid_11 = {"11", "12", "22", "23", "24", "31", "32", "49", "50",
                            "51", "52", "53", "54", "55", "56", "57", "60", "61",
                            "62", "65", "71", "72", "81", "99"}
                if facility and facility not in valid_11:
                    errors.append(self._err(
                        segment="CLM", element="CLM05-1",
                        error_code="H014",
                        severity="warning",
                        message=f"Claim '{claim_id}': facility type code '{facility}' is unusual for an 837P.",
                        explanation=(
                            "837P professional claims typically use place-of-service codes like "
                            "11 (office), 22 (outpatient hospital), 23 (ER). "
                            "Institutional codes (21, 22-inpatient) belong in an 837I."
                        ),
                        suggestion=None,
                    ))

        return errors

    # ------------------------------------------------------------------ #
    # 835 Validation
    # ------------------------------------------------------------------ #
    def _validate_835(self, parsed: dict) -> List[Dict[str, Any]]:
        errors = []

        payer = parsed.get("payer", {}).get("name", "")
        payee = parsed.get("payee", {}).get("name", "")
        check = parsed.get("check_info", {})

        if not payer:
            errors.append(self._err(
                segment="N1", element="N102",
                error_code="R001",
                severity="warning",
                message="Payer name (N1*PR) is missing.",
                explanation="The PR N1 loop should identify the payer sending the remittance.",
                suggestion=None,
            ))
        if not payee:
            errors.append(self._err(
                segment="N1", element="N102",
                error_code="R002",
                severity="warning",
                message="Payee name (N1*PE) is missing.",
                explanation="The PE N1 loop should identify the provider receiving payment.",
                suggestion=None,
            ))

        amount = check.get("amount", "")
        if not amount:
            errors.append(self._err(
                segment="BPR", element="BPR02",
                error_code="R003",
                severity="error",
                message="Total payment amount (BPR02) is missing.",
                explanation="BPR02 is the total amount of the remittance payment and is required.",
                suggestion=None,
            ))

        claims = parsed.get("claims", [])
        for claim in claims:
            claim_id = claim.get("claim_id", "?")
            billed = claim.get("billed_amount", "")
            paid = claim.get("paid_amount", "")

            if not billed:
                errors.append(self._err(
                    segment="CLP", element="CLP03",
                    error_code="R004",
                    severity="warning",
                    message=f"Claim '{claim_id}': billed amount (CLP03) is missing.",
                    explanation="CLP03 is the total amount charged by the provider for this claim.",
                    suggestion=None,
                ))
            if not paid:
                errors.append(self._err(
                    segment="CLP", element="CLP04",
                    error_code="R005",
                    severity="warning",
                    message=f"Claim '{claim_id}': paid amount (CLP04) is missing.",
                    explanation="CLP04 is the amount the payer is paying for this claim.",
                    suggestion=None,
                ))

            # Crossed amounts check
            try:
                b = float(billed or 0)
                p = float(paid or 0)
                if p > b:
                    errors.append(self._err(
                        segment="CLP", element="CLP04",
                        error_code="R006",
                        severity="warning",
                        message=f"Claim '{claim_id}': paid amount (${p}) exceeds billed amount (${b}).",
                        explanation=(
                            "A payer should never pay more than what was billed. "
                            "This may indicate a data entry error."
                        ),
                        suggestion=None,
                    ))
            except (ValueError, TypeError):
                pass

        return errors

    # ------------------------------------------------------------------ #
    # 834 Validation
    # ------------------------------------------------------------------ #
    def _validate_834(self, parsed: dict) -> List[Dict[str, Any]]:
        errors = []

        members = parsed.get("members", [])
        if not members:
            errors.append(self._err(
                segment="INS", element="INS01",
                error_code="E001",
                severity="error",
                message="No member (INS) segments found in the 834 transaction.",
                explanation="An 834 Benefit Enrollment file must contain at least one member record.",
                suggestion=None,
            ))

        for member in members:
            name = member.get("name", "")
            sub_id = member.get("subscriber_id", "")
            dob = member.get("dob", "")
            maint = member.get("maintenance_type", "")

            if not name:
                errors.append(self._err(
                    segment="NM1", element="NM103",
                    error_code="E002",
                    severity="error",
                    message="A member record is missing the subscriber name (NM103).",
                    explanation="The member's last name is required in NM103 of the 2000 loop.",
                    suggestion=None,
                ))

            if not sub_id:
                errors.append(self._err(
                    segment="REF", element="REF02",
                    error_code="E003",
                    severity="warning",
                    message=f"Member '{name or 'Unknown'}': subscriber ID (REF*0F) is missing.",
                    explanation=(
                        "The subscriber ID in REF*0F uniquely identifies the member "
                        "with the insurance carrier and is typically required."
                    ),
                    suggestion=None,
                ))

            if not dob:
                errors.append(self._err(
                    segment="DMG", element="DMG02",
                    error_code="E004",
                    severity="warning",
                    message=f"Member '{name or 'Unknown'}': date of birth (DMG02) is missing.",
                    explanation="Date of birth is required by most insurance carriers for enrollment.",
                    suggestion=None,
                ))

            valid_maint = {"001", "021", "024", "025", "030", "XB", "XC"}
            if maint and maint not in valid_maint:
                errors.append(self._err(
                    segment="INS", element="INS03",
                    error_code="E005",
                    severity="error",
                    message=f"Member '{name or 'Unknown'}': unknown maintenance type code '{maint}'.",
                    explanation=(
                        "INS03 must be a valid maintenance type: 001 (Change), 021 (Addition), "
                        "024 (Cancellation), 025 (Reinstatement), etc."
                    ),
                    suggestion=None,
                ))

        return errors

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _err(
        segment: str,
        element: str,
        error_code: str,
        severity: str,
        message: str,
        explanation: str,
        suggestion,
    ) -> Dict[str, Any]:
        return {
            "segment": segment,
            "element": element,
            "error_code": error_code,
            "severity": severity,
            "message": message,
            "explanation": explanation,
            "suggestion": suggestion,
        }

    @staticmethod
    def _luhn_check(npi: str) -> bool:
        """Validate NPI using the Luhn algorithm with a constant prefix of 80840."""
        if not npi or len(npi) != 10 or not npi.isdigit():
            return False
        # Prefix 80840 prepended for NPI Luhn calculation
        full = "80840" + npi
        total = 0
        for i, ch in enumerate(reversed(full)):
            n = int(ch)
            if i % 2 == 1:
                n *= 2
                if n > 9:
                    n -= 9
            total += n
        return total % 10 == 0

    @staticmethod
    def _valid_icd10(code: str) -> bool:
        """Basic ICD-10-CM format check: letter + 2+ digits, optional alphanumeric suffix."""
        import re
        return bool(re.match(r"^[A-Z][0-9]{2}([A-Z0-9]{0,4})?$", code.upper().replace(".", "")))
