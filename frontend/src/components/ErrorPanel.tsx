import { useState } from "react";
import type { ValidationError } from "../types";
import { CheckCircle2, Check, Lightbulb, AlertCircle, AlertTriangle } from "lucide-react";

interface Props {
  errors: ValidationError[];
  onSegmentClick: (segment: string) => void;
  onApplyFix: (error: ValidationError, index: number) => Promise<void>;
  sessionId: string | null;
}

export default function ErrorPanel({ errors, onSegmentClick, onApplyFix, sessionId }: Props) {
  const [fixing, setFixing] = useState<number | null>(null);
  const [fixed, setFixed] = useState<Set<number>>(new Set());

  const errorList = errors.filter(e => e.severity === "error");
  const warnList = errors.filter(e => e.severity === "warning");

  const handleFix = async (e: ValidationError, index: number) => {
    if (!e.suggestion || !sessionId) return;
    setFixing(index);
    try {
      await onApplyFix(e, index);
      setFixed(prev => new Set([...prev, index]));
    } finally {
      setFixing(null);
    }
  };

  if (errors.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginBottom: 16 }}><CheckCircle2 size={56} color="#166534" /></div>
        <h3 style={{ color: "#166534", margin: 0 }}>No validation errors found!</h3>
        <p style={{ color: "#64748b", fontSize: 14 }}>This file passes all X12 HIPAA 5010 validation rules.</p>
      </div>
    );
  }

  const renderErrorCard = (error: ValidationError, index: number) => {
    const isFixed = fixed.has(index);
    const isFixing = fixing === index;
    const canFix = !!error.suggestion && !isFixed;

    return (
      <div
        key={index}
        id={`error-${index}`}
        style={{
          background: isFixed ? "#f0fdf4" : error.severity === "error" ? "#fff8f8" : "#fffbeb",
          border: `1px solid ${isFixed ? "#bbf7d0" : error.severity === "error" ? "#fecaca" : "#fde68a"}`,
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 10,
          cursor: "pointer",
          transition: "box-shadow 0.15s",
          opacity: isFixed ? 0.7 : 1,
        }}
        onClick={() => onSegmentClick(error.segment)}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.boxShadow = "none"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 12,
                background: error.severity === "error" ? "#fee2e2" : "#fef9c3",
                color: error.severity === "error" ? "#dc2626" : "#92400e",
                padding: "2px 8px",
                borderRadius: 5,
              }}>
                {error.segment} {error.element}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#94a3b8",
                background: "#f1f5f9",
                padding: "2px 6px",
                borderRadius: 4,
              }}>
                {error.error_code}
              </span>
              {isFixed && (
                <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                  <Check size={14} /> Fixed
                </span>
              )}
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
              {error.message}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              {error.explanation}
            </p>
            {error.suggestion && !isFixed && (
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#2563eb", display: "flex", alignItems: "center", gap: 6 }}>
                <Lightbulb size={14} /> <strong>Suggested fix:</strong>{" "}
                <code style={{ background: "#eff6ff", padding: "1px 5px", borderRadius: 4 }}>
                  {error.suggestion}
                </code>
              </p>
            )}
          </div>

          {canFix && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFix(error, index); }}
              disabled={isFixing}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: isFixing ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {isFixing ? "Fixing..." : "Apply Fix"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Click any error to highlight it in the tree view
        </span>
      </div>

      {errorList.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} /> Errors ({errorList.length})
          </h3>
          {errorList.map((e, i) => renderErrorCard(e, i))}
        </div>
      )}

      {warnList.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d97706", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={16} /> Warnings ({warnList.length})
          </h3>
          {warnList.map((e, i) => renderErrorCard(e, errorList.length + i))}
        </div>
      )}
    </div>
  );
}