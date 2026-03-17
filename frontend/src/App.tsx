import { useState, useCallback } from "react";
import Upload from "./components/Upload";
import MetadataBar from "./components/MetadataBar";
import TreeView from "./components/TreeView";
import ErrorPanel from "./components/ErrorPanel";
import SummaryPanel from "./components/Summary";
import Chat from "./components/Chat";
import type { AppState, ValidationError } from "./types";
import { uploadFile, parseFile, validateFile, getSummary, applyFix, downloadJSON, downloadErrorReport } from "./utils/api";
import { Activity, Download, Loader2, Network, AlertCircle, BarChart3, MessageSquare } from "lucide-react";

const TABS = [
  { key: "tree",    label: "Parsed Tree", icon: Network },
  { key: "errors",  label: "Errors", icon: AlertCircle },
  { key: "summary", label: "Summary", icon: BarChart3 },
  { key: "chat",    label: "AI Chat", icon: MessageSquare },
] as const;

type Tab = typeof TABS[number]["key"];

const INIT: AppState = {
  step: "idle",
  sessionId: null,
  metadata: null,
  parsed: null,
  errors: [],
  errorCount: 0,
  warningCount: 0,
  summary: null,
  loading: false,
  activeTab: "tree",
  highlightedSegment: null,
};

export default function App() {
  const [state, setState] = useState<AppState>(INIT);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = useCallback(async (file: File) => {
    setState(s => ({ ...s, loading: true }));
    try {
      // 1. Upload
      const upRes = await uploadFile(file);
      const sessionId = upRes.session_id;
      const metadata = upRes.metadata;

      setState(s => ({ ...s, sessionId, metadata, step: "uploaded" }));

      // 2. Parse
      const parseRes = await parseFile(sessionId);
      setState(s => ({ ...s, parsed: parseRes.parsed, step: "parsed" }));

      // 3. Validate
      const valRes = await validateFile(sessionId);
      setState(s => ({
        ...s,
        errors: valRes.errors,
        errorCount: valRes.error_count,
        warningCount: valRes.warning_count,
        step: "validated",
      }));

      // 4. Summary
      const sumRes = await getSummary(sessionId);
      setState(s => ({ ...s, summary: sumRes.summary, loading: false }));

      // Auto-switch tab
      const autoTab: Tab = valRes.error_count > 0 ? "errors" : "summary";
      setState(s => ({ ...s, activeTab: autoTab }));

      showToast(`✓ ${metadata.transaction_type} file processed — ${valRes.error_count} error(s) found`);
    } catch (err: any) {
      showToast("❌ " + (err.message || "Upload failed"));
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const handleApplyFix = async (error: ValidationError, index: number) => {
    if (!state.sessionId || !error.suggestion) return;
    try {
      const res = await applyFix(state.sessionId, error.segment, error.element, error.suggestion, index);
      setState(s => ({
        ...s,
        parsed: res.parsed,
        errors: res.errors,
        errorCount: res.errors.filter((e: ValidationError) => e.severity === "error").length,
        warningCount: res.errors.filter((e: ValidationError) => e.severity === "warning").length,
      }));
      showToast(`✓ Fixed ${error.segment} ${error.element} → ${error.suggestion}`);
    } catch (err: any) {
      showToast("❌ Fix failed: " + err.message);
    }
  };

  const reset = () => setState(INIT);

  if (state.step === "idle") {
    return (
      <div style={{ minHeight: "100vh", background: "transparent" }}>
        <Upload onUpload={handleUpload} loading={state.loading} />
      </div>
    );
  }

  const errorBadge = state.errorCount > 0 ? ` (${state.errorCount})` : state.warningCount > 0 ? ` (${state.warningCount})` : "";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "transparent", fontFamily: "system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.startsWith("❌") ? "#fee2e2" : "#dcfce7",
          color: toast.startsWith("❌") ? "#991b1b" : "#166534",
          border: `1px solid ${toast.startsWith("❌") ? "#fecaca" : "#bbf7d0"}`,
          borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Activity size={24} color="#2563eb" />
        <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>EDI Parser</span>
        <span style={{ color: "#e2e8f0" }}>|</span>

        {/* Export buttons */}
        {state.parsed && (
          <>
            <button
              onClick={() => downloadJSON(state.parsed, `edi_parsed_${state.metadata?.transaction_type}.json`)}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 12px", cursor: "pointer", fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> JSON
            </button>
            <button
              onClick={() => downloadErrorReport(state.errors, state.metadata)}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 12px", cursor: "pointer", fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> Error Report
            </button>
          </>
        )}

        {state.loading && (
          <span style={{ fontSize: 12, color: "#3b82f6", marginLeft: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={14} className="spin" /> Processing...
          </span>
        )}
      </div>

      {/* Metadata bar */}
      {state.metadata && (
        <MetadataBar
          metadata={state.metadata}
          errorCount={state.errorCount}
          warningCount={state.warningCount}
          onReset={reset}
        />
      )}

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", display: "flex", gap: 0 }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const label = tab.key === "errors"
            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={16} /> Errors{errorBadge}</span>
            : <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={16} /> {tab.label}</span>;
          return (
            <button
              key={tab.key}
              onClick={() => setState(s => ({ ...s, activeTab: tab.key }))}
              style={{
                background: "none",
                border: "none",
                borderBottom: state.activeTab === tab.key ? "2px solid #2563eb" : "2px solid transparent",
                color: state.activeTab === tab.key ? "#2563eb" : "#64748b",
                fontWeight: state.activeTab === tab.key ? 700 : 500,
                fontSize: 13,
                padding: "12px 18px",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Main content — split layout for tree + errors, full for others */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {state.activeTab === "tree" && state.parsed && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <TreeView
              parsed={state.parsed}
              errors={state.errors}
              highlightedSegment={state.highlightedSegment}
            />
          </div>
        )}

        {state.activeTab === "errors" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ErrorPanel
              errors={state.errors}
              sessionId={state.sessionId}
              onSegmentClick={(seg) => {
                setState(s => ({ ...s, highlightedSegment: seg, activeTab: "tree" }));
                setTimeout(() => {
                  document.getElementById(`seg-${seg}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
              onApplyFix={handleApplyFix}
            />
          </div>
        )}

        {state.activeTab === "summary" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <SummaryPanel summary={state.summary} />
          </div>
        )}

        {state.activeTab === "chat" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Chat sessionId={state.sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}

