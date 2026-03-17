import { useState } from "react";
import type { ValidationError } from "../types";
import { AlertCircle } from "lucide-react";

interface TreeNodeProps {
  label: string;
  value: any;
  depth?: number;
  errorSegments: Set<string>;
  highlightedSegment?: string | null;
}

function TreeNode({ label, value, depth = 0, errorSegments, highlightedSegment }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArr = Array.isArray(value);
  const isPrim = !isObj && !isArr;

  // Check if this node or any label matches an error segment
  const hasError = errorSegments.has(label.toUpperCase());
  const isHighlighted = highlightedSegment && label.toUpperCase() === highlightedSegment.toUpperCase();

  const indent = depth * 16;

  if (isPrim) {
    return (
      <div style={{
        paddingLeft: indent + 16,
        paddingTop: 2,
        paddingBottom: 2,
        display: "flex",
        gap: 8,
        alignItems: "baseline",
        fontSize: 13,
      }}>
        <span style={{ color: "#94a3b8", minWidth: 140, fontSize: 12 }}>{label}</span>
        <span style={{ color: value === "" || value === null ? "#cbd5e1" : "#0f172a", fontFamily: "monospace" }}>
          {value === "" || value === null ? "—" : String(value)}
        </span>
      </div>
    );
  }

  const childCount = isArr ? value.length : Object.keys(value).length;
  if (childCount === 0) return null;

  // Skip raw_segments in the pretty tree
  if (label === "raw_segments") return null;

  return (
    <div
      id={`seg-${label}`}
      style={{
        marginLeft: indent,
        borderLeft: depth > 0 ? "1px solid #f1f5f9" : "none",
        marginTop: 2,
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 6,
          background: isHighlighted ? "#fef9c3" : hasError ? "#fff1f2" : "transparent",
          border: isHighlighted ? "1px solid #fbbf24" : hasError ? "1px solid #fecaca" : "1px solid transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isHighlighted && !hasError)
            (e.currentTarget as HTMLElement).style.background = "#f8fafc";
        }}
        onMouseLeave={(e) => {
          if (!isHighlighted && !hasError)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ fontSize: 10, color: "#94a3b8", userSelect: "none" }}>
          {open ? "▼" : "▶"}
        </span>
        <span style={{
          fontWeight: 600,
          fontSize: 13,
          color: hasError ? "#dc2626" : "#1e293b",
          fontFamily: /^[A-Z0-9]{2,3}$/.test(label) ? "monospace" : "inherit",
        }}>
          {label}
        </span>
        {hasError && (
          <span style={{ fontSize: 10, background: "#fee2e2", color: "#dc2626", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
            ⚠ error
          </span>
        )}
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
          {isArr ? `[${childCount}]` : `{${childCount}}`}
        </span>
      </div>

      {open && (
        <div style={{ paddingLeft: 8 }}>
          {isArr
            ? value.map((item: any, i: number) => (
                <TreeNode
                  key={i}
                  label={isObj && item?.tag ? item.tag : `[${i}]`}
                  value={item}
                  depth={depth + 1}
                  errorSegments={errorSegments}
                  highlightedSegment={highlightedSegment}
                />
              ))
            : Object.entries(value).map(([k, v]) => (
                <TreeNode
                  key={k}
                  label={k}
                  value={v}
                  depth={depth + 1}
                  errorSegments={errorSegments}
                  highlightedSegment={highlightedSegment}
                />
              ))
          }
        </div>
      )}
    </div>
  );
}

interface Props {
  parsed: any;
  errors: ValidationError[];
  highlightedSegment: string | null;
}

export default function TreeView({ parsed, errors, highlightedSegment }: Props) {
  const errorSegments = new Set(errors.map(e => e.segment.toUpperCase()));

  // Build a clean view — remove raw_segments from top level display
  const displayData = Object.fromEntries(
    Object.entries(parsed).filter(([k]) => k !== "raw_segments")
  );

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
          Parsed Structure
        </h3>
        {errorSegments.size > 0 && (
          <span style={{ fontSize: 12, color: "#dc2626", background: "#fff1f2", padding: "3px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} /> Red nodes have errors
          </span>
        )}
      </div>

      {Object.entries(displayData).map(([k, v]) => (
        <TreeNode
          key={k}
          label={k}
          value={v}
          depth={0}
          errorSegments={errorSegments}
          highlightedSegment={highlightedSegment}
        />
      ))}
    </div>
  );
}