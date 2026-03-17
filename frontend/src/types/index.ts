export interface Metadata {
  session_id: string;
  transaction_type: "837P" | "837I" | "835" | "834" | "UNKNOWN";
  sender_id: string;
  receiver_id: string;
  interchange_date: string;
  interchange_time: string;
  interchange_control: string;
  gs_functional_group: string;
  total_segments: number;
}

export interface ValidationError {
  segment: string;
  element: string;
  error_code: string;
  message: string;
  explanation: string;
  severity: "error" | "warning";
  suggestion?: string;
}

export interface Claim835 {
  claim_id: string;
  patient_name: string;
  payer_icn: string;
  billed: string;
  paid: string;
  patient_responsibility: string;
  status: "paid_full" | "partial" | "denied";
  status_label: string;
  adjustments: Adjustment[];
}

export interface Adjustment {
  group: string;
  group_label: string;
  carc: string;
  amount: string;
  explanation: string;
}

export interface Summary835 {
  type: "835";
  payer: string;
  payee: string;
  check_number: string;
  payment_date: string;
  total_payment: string;
  stats: {
    total_claims: number;
    paid_full: number;
    partial: number;
    denied: number;
    total_billed: number;
    total_paid: number;
    total_patient_responsibility: number;
  };
  claims: Claim835[];
}

export interface Member834 {
  name: string;
  subscriber_id: string;
  dob: string;
  gender: string;
  relationship: string;
  maintenance_type: string;
  maintenance_label: string;
  status: "addition" | "termination" | "change" | "other";
  coverage_begin: string;
  coverage_end: string;
  group_number: string;
  coverage_plans: string[];
}

export interface Summary834 {
  type: "834";
  sponsor: string;
  insurer: string;
  stats: {
    total_members: number;
    additions: number;
    changes: number;
    terminations: number;
    other: number;
  };
  members: Member834[];
}

export interface Summary837 {
  type: "837";
  claim_count: number;
  total_billed: number;
  billing_provider: string;
  claims: any[];
}

export type Summary = Summary835 | Summary834 | Summary837;

export interface AppState {
  step: "idle" | "uploaded" | "parsed" | "validated";
  sessionId: string | null;
  metadata: Metadata | null;
  parsed: any | null;
  errors: ValidationError[];
  errorCount: number;
  warningCount: number;
  summary: Summary | null;
  loading: boolean;
  activeTab: "tree" | "errors" | "summary" | "chat";
  highlightedSegment: string | null;
}