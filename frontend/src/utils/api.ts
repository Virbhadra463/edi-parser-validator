const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function parseFile(sessionId: string) {
  const res = await fetch(`${BASE}/parse/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validateFile(sessionId: string) {
  const res = await fetch(`${BASE}/validate/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSummary(sessionId: string) {
  const res = await fetch(`${BASE}/summary/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendChat(sessionId: string, question: string) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function applyFix(sessionId: string, segment: string, element: string, suggestedValue: string, errorIndex: number) {
  const res = await fetch(`${BASE}/fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      segment,
      element,
      suggested_value: suggestedValue,
      error_index: errorIndex,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadErrorReport(errors: any[], metadata: any) {
  const lines = [
    `EDI VALIDATION REPORT`,
    `Transaction: ${metadata?.transaction_type}`,
    `Date: ${new Date().toLocaleString()}`,
    `Sender: ${metadata?.sender_id} → Receiver: ${metadata?.receiver_id}`,
    `Total Issues: ${errors.length}`,
    `${"=".repeat(60)}`,
    "",
    ...errors.map((e, i) =>
      `[${i + 1}] ${e.severity.toUpperCase()} — ${e.segment} ${e.element} (${e.error_code})\n` +
      `    ${e.message}\n` +
      `    Explanation: ${e.explanation}` +
      (e.suggestion ? `\n    Suggestion: ${e.suggestion}` : "")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "edi_error_report.txt";
  a.click();
  URL.revokeObjectURL(url);
}