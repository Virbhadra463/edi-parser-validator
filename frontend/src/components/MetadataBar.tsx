import type { Metadata } from "../types";
import { Send, Inbox, Calendar, List, Hash, RotateCcw, CheckCircle2 } from "lucide-react";

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "837P": { bg: "#dcfce7", text: "#166534", label: "837P — Professional Claim" },
  "837I": { bg: "#fef9c3", text: "#854d0e", label: "837I — Institutional Claim" },
  "835":  { bg: "#dbeafe", text: "#1e40af", label: "835 — Remittance Advice" },
  "834":  { bg: "#f3e8ff", text: "#6b21a8", label: "834 — Benefit Enrollment" },
  "UNKNOWN": { bg: "#fee2e2", text: "#991b1b", label: "Unknown Transaction" },
};

function formatDate(d: string) {
  if (!d || d.length < 6) return d;
  if (d.length === 6) return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

interface Props {
  metadata: Metadata;
  errorCount: number;
  warningCount: number;
  onReset: () => void;
}

export default function MetadataBar({ metadata, errorCount, warningCount, onReset }: Props) {
  const type = TYPE_COLORS[metadata.transaction_type] || TYPE_COLORS["UNKNOWN"];

  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #e2e8f0",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
    }}>
      {/* Transaction type badge */}
      <span style={{
        background: type.bg,
        color: type.text,
        fontWeight: 700,
        fontSize: 13,
        padding: "4px 12px",
        borderRadius: 20,
      }}>
        {type.label}
      </span>

      <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Send size={14} /> <strong>From:</strong> {metadata.sender_id || "—"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Inbox size={14} /> <strong>To:</strong> {metadata.receiver_id || "—"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> <strong>Date:</strong> {formatDate(metadata.interchange_date)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><List size={14} /> <strong>Segments:</strong> {metadata.total_segments}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Hash size={14} /> <strong>Control#:</strong> {metadata.interchange_control}</span>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        {errorCount > 0 && (
          <span style={{ background: "#fee2e2", color: "#991b1b", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 12 }}>
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}
        {warningCount > 0 && (
          <span style={{ background: "#fef9c3", color: "#854d0e", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 12 }}>
            {warningCount} warning{warningCount !== 1 ? "s" : ""}
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 12 }}>
            <CheckCircle2 size={14} /> Valid
          </span>
        )}
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 12,
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <RotateCcw size={14} /> New File
        </button>
      </div>
    </div>
  );
}