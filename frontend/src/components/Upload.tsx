import React, { useCallback, useState } from "react";
import { Activity, Loader2, UploadCloud } from "lucide-react";

const SAMPLES = [
  { label: "837P — Valid Professional Claim", file: "sample_837p_valid.edi", tag: "837P", color: "#22c55e" },
  { label: "837I — Malformed Institutional (5 errors)", file: "sample_837i_errors.edi", tag: "837I", color: "#ef4444" },
  { label: "835 — Payment Remittance", file: "sample_835.edi", tag: "835", color: "#3b82f6" },
  { label: "834 — Member Enrollment", file: "sample_834.edi", tag: "834", color: "#a855f7" },
];

interface Props {
  onUpload: (file: File) => void;
  loading: boolean;
}

export default function Upload({ onUpload, loading }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  const loadSample = async (filename: string) => {
    const res = await fetch(`/samples/${filename}`);
    const text = await res.text();
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], filename, { type: "text/plain" });
    onUpload(file);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
          <Activity size={48} color="#2563eb" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>
          EDI Parser & Validator
        </h1>
        <p style={{ color: "#64748b", marginTop: 8, fontSize: 15 }}>
          Upload any X12 837 / 835 / 834 file — auto-detect, parse, validate, and explain
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => document.getElementById("file-input")?.click()}
        style={{
          border: `2px dashed ${dragging ? "#3b82f6" : "#cbd5e1"}`,
          borderRadius: 16,
          padding: "48px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "#eff6ff" : "#f8fafc",
          transition: "all 0.2s",
          marginBottom: 28,
        }}
      >
        <input
          id="file-input"
          type="file"
          accept=".edi,.txt,.dat,.x12"
          style={{ display: "none" }}
          onChange={handleChange}
        />
        {loading ? (
          <div style={{ padding: "20px 0" }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <Loader2 size={36} color="#3b82f6" className="spin" />
            </div>
            <p style={{ color: "#3b82f6", fontWeight: 600, margin: 0 }}>
              Waking up server. It may take a few seconds, please wait...
            </p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <UploadCloud size={44} color="#64748b" />
            </div>
            <p style={{ fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>
              Drop your EDI file here or click to browse
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Supports .edi · .txt · .dat · .x12
            </p>
          </div>
        )}
      </div>

      {/* Sample Files */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
          Load a sample file
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              onClick={() => loadSample(s.file)}
              disabled={loading}
              style={{
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                padding: "12px 14px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = s.color;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 3px ${s.color}22`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              <span style={{
                background: s.color + "20",
                color: s.color,
                fontWeight: 700,
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 5,
                whiteSpace: "nowrap",
              }}>
                {s.tag}
              </span>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}