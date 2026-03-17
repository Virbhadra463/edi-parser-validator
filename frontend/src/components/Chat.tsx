import { useState, useRef, useEffect } from "react";
import { sendChat } from "../utils/api";
import { Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Why was this claim rejected?",
  "What do the error codes mean?",
  "Explain the CLM segment",
  "What is CARC code 45?",
  "How do I fix the NPI error?",
  "What is this 835 file paying?",
  "Which members are being terminated?",
];

interface Props {
  sessionId: string | null;
}

export default function Chat({ sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm your EDI assistant. I've analyzed your file and can answer specific questions about its content, errors, and structure. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !sessionId || loading) return;
    const question = text.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await sendChat(sessionId, question);
      setMessages(prev => [...prev, { role: "assistant", text: res.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I couldn't reach the AI service. Please check your GEMINI_API_KEY." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "system-ui, sans-serif" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%",
              background: msg.role === "user" ? "#2563eb" : "#f1f5f9",
              color: msg.role === "user" ? "#fff" : "#1e293b",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 14px",
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {msg.role === "assistant" && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Bot size={14} /> EDI Assistant
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#f1f5f9", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", fontSize: 20, letterSpacing: 4 }}>
              <span style={{ animation: "pulse 1s infinite" }}>···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      <div style={{ padding: "0 12px 8px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading || !sessionId}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 11,
              whiteSpace: "nowrap",
              cursor: "pointer",
              color: "#475569",
              flexShrink: 0,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
          placeholder={sessionId ? "Ask about this EDI file..." : "Upload a file first..."}
          disabled={!sessionId || loading}
          style={{
            flex: 1,
            border: "1.5px solid #e2e8f0",
            borderRadius: 10,
            padding: "9px 14px",
            fontSize: 13,
            outline: "none",
            background: sessionId ? "#fff" : "#f8fafc",
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!sessionId || loading || !input.trim()}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "9px 18px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            opacity: (!sessionId || loading || !input.trim()) ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}