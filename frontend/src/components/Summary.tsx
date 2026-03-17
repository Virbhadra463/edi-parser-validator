import React, { useState } from "react";
import type { Summary, Summary835, Summary834, Summary837 } from "../types";
import { AlertTriangle, BarChart3 } from "lucide-react";

function fmt(val: string | number | undefined) {
  if (val === undefined || val === null || val === "") return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d: string) {
  if (!d || d.length < 8) return d || "—";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid_full:   { bg: "#dcfce7", color: "#166534", label: "✓ Paid in Full" },
  partial:     { bg: "#fef9c3", color: "#854d0e", label: "~ Partial" },
  denied:      { bg: "#fee2e2", color: "#991b1b", label: "✗ Denied" },
  addition:    { bg: "#dcfce7", color: "#166534", label: "+ Addition" },
  change:      { bg: "#dbeafe", color: "#1e40af", label: "~ Change" },
  termination: { bg: "#fee2e2", color: "#991b1b", label: "✗ Termination" },
  other:       { bg: "#f1f5f9", color: "#475569", label: "Other" },
};

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function View835({ s }: { s: Summary835 }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const st = s.stats;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 3px 0", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>835 — Payment Remittance Summary</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
          {s.payer} → {s.payee} · Check #{s.check_number || "—"} · {fmtDate(s.payment_date)}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <StatCard label="Total Claims" value={st.total_claims} color="#6366f1" />
        <StatCard label="Paid in Full" value={st.paid_full} color="#22c55e" />
        <StatCard label="Denied" value={st.denied} color="#ef4444" />
        <StatCard label="Total Billed" value={fmt(st.total_billed)} color="#3b82f6" />
        <StatCard label="Total Paid" value={fmt(st.total_paid)} color="#22c55e" />
        <StatCard label="Patient Resp." value={fmt(st.total_patient_responsibility)} color="#a855f7" />
      </div>
      {st.denied > 0 && (
        <div style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} /> {st.denied} claim(s) denied — expand rows below to see adjustment reason codes.
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Claim ID", "Patient", "Billed", "Paid", "Pt. Resp.", "Status", ""].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.claims.map((claim, i) => {
              const css = STATUS_STYLE[claim.status] || STATUS_STYLE.other;
              const isExp = expanded === claim.claim_id;
              return (
                <React.Fragment key={i}>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "9px 10px", fontFamily: "monospace", fontWeight: 600, color: "#1e293b" }}>{claim.claim_id}</td>
                    <td style={{ padding: "9px 10px", color: "#374151" }}>{claim.patient_name || "—"}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmt(claim.billed)}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "monospace", fontWeight: 700, color: claim.status === "denied" ? "#dc2626" : "#166534" }}>{fmt(claim.paid)}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmt(claim.patient_responsibility)}</td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{ background: css.bg, color: css.color, fontWeight: 700, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{css.label}</span>
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      {claim.adjustments.length > 0 && (
                        <button onClick={() => setExpanded(isExp ? null : claim.claim_id)}
                          style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontSize: 11, color: "#64748b" }}>
                          {isExp ? "▲ Hide" : `▼ ${claim.adjustments.length} adj.`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ background: "#f8fafc" }}>
                      <td colSpan={7} style={{ padding: "8px 10px 12px 28px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Claim Adjustments</div>
                        {claim.adjustments.map((adj, j) => (
                          <div key={j} style={{ display: "flex", gap: 10, fontSize: 12, margin: "4px 0", alignItems: "baseline", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, background: "#e2e8f0", color: "#374151", padding: "1px 6px", borderRadius: 4 }}>{adj.group} — {adj.group_label}</span>
                            <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#6366f1" }}>CARC {adj.carc}</span>
                            <span style={{ color: "#dc2626", fontFamily: "monospace", fontWeight: 600 }}>{fmt(adj.amount)}</span>
                            <span style={{ color: "#475569" }}>{adj.explanation}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function View834({ s }: { s: Summary834 }) {
  const st = s.stats;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 3px 0", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>834 — Member Enrollment Summary</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{s.sponsor} → {s.insurer}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        <StatCard label="Total Members" value={st.total_members} color="#6366f1" />
        <StatCard label="Additions" value={st.additions} color="#22c55e" />
        <StatCard label="Changes" value={st.changes} color="#3b82f6" />
        <StatCard label="Terminations" value={st.terminations} color="#ef4444" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name", "Member ID", "DOB", "Gender", "Relationship", "Action", "Coverage Begin", "Coverage End", "Plan"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.members.map((m, i) => {
              const css = STATUS_STYLE[m.status] || STATUS_STYLE.other;
              return (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e293b" }}>{m.name || "—"}</td>
                  <td style={{ padding: "9px 10px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{m.subscriber_id || "—"}</td>
                  <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmtDate(m.dob)}</td>
                  <td style={{ padding: "9px 10px", textAlign: "center" }}>{m.gender === "M" ? "♂" : m.gender === "F" ? "♀" : m.gender || "—"}</td>
                  <td style={{ padding: "9px 10px", color: "#475569" }}>{m.relationship || "—"}</td>
                  <td style={{ padding: "9px 10px" }}>
                    <span style={{ background: css.bg, color: css.color, fontWeight: 700, fontSize: 11, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{css.label}</span>
                  </td>
                  <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmtDate(m.coverage_begin)}</td>
                  <td style={{ padding: "9px 10px", fontFamily: "monospace", color: m.coverage_end ? "#dc2626" : "#94a3b8" }}>{fmtDate(m.coverage_end) || "Active"}</td>
                  <td style={{ padding: "9px 10px", color: "#475569" }}>{m.coverage_plans.filter(Boolean).join(", ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function View837({ s }: { s: Summary837 }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 3px 0", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>837 — Claims Overview</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Billing Provider: {s.billing_provider || "—"}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <StatCard label="Total Claims" value={s.claim_count} color="#6366f1" />
        <StatCard label="Total Billed" value={"$" + (s.total_billed || 0).toFixed(2)} color="#3b82f6" />
        <StatCard label="Service Lines" value={s.claims.reduce((a: number, c: any) => a + (c.service_count || 0), 0)} color="#22c55e" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Claim ID", "Total Charge", "Service Date", "Facility", "Services", "Diagnoses"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.claims.map((c: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "9px 10px", fontFamily: "monospace", fontWeight: 600 }}>{c.claim_id || "—"}</td>
                <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmt(c.total_charge)}</td>
                <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{fmtDate(c.service_date)}</td>
                <td style={{ padding: "9px 10px" }}>{c.facility_type || "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>{c.service_count}</td>
                <td style={{ padding: "9px 10px", fontFamily: "monospace", fontSize: 11, color: "#6366f1" }}>{(c.diagnoses || []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SummaryPanel({ summary }: { summary: Summary | null }) {
  if (!summary) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ marginBottom: 16 }}><BarChart3 size={56} color="#cbd5e1" /></div>
      <p>No summary data yet.</p>
    </div>
  );
  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
      {summary.type === "835" && <View835 s={summary as Summary835} />}
      {summary.type === "834" && <View834 s={summary as Summary834} />}
      {summary.type === "837" && <View837 s={summary as Summary837} />}
    </div>
  );
}