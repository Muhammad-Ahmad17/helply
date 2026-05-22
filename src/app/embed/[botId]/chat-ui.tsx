"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Bot as BotIcon, Loader2 } from "lucide-react";
import { getAppUrl } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

function makeVisitorId() {
  const KEY = "helply-vid";
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}

export function ChatUI({ botId, botName, welcome, color }: { botId: string; botName: string; welcome: string; color: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: welcome }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const vid = useRef("");

  useEffect(() => { vid.current = makeVisitorId(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${getAppUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, visitorId: vid.current, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((p) => { const o = [...p]; o[o.length - 1] = { role: "assistant", content: acc }; return o; });
      }
    } catch (err) {
      setMessages((p) => { const o = [...p]; o[o.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." + (err instanceof Error ? ` (${err.message})` : "") }; return o; });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: color }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <BotIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white leading-tight">{botName}</p>
            <p className="text-[11px] text-white/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" /> Online
            </p>
          </div>
        </div>
        <button onClick={() => window.parent.postMessage({ helply: true, type: "close" }, "*")} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background: "#fafafa" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
              style={
                m.role === "user"
                  ? { background: color, color: "#fff", borderRadius: "10px 10px 2px 10px" }
                  : { background: "#fff", color: "#27272a", borderRadius: "10px 10px 10px 2px", border: "1px solid #e4e4e7" }
              }
            >
              {m.content || <span style={{ opacity: 0.3 }}>...</span>}
            </div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center gap-1.5 px-1">
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#a1a1aa" }} />
            <span style={{ fontSize: 11, color: "#a1a1aa" }}>Thinking...</span>
          </div>
        )}
      </div>

      {/* input */}
      <div style={{ borderTop: "1px solid #e4e4e7", background: "#fff", padding: "10px 12px" }}>
        <form onSubmit={send} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={streaming}
            style={{
              flex: 1,
              height: 40,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 13,
              outline: "none",
              color: "#27272a",
              background: "#fafafa",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              border: "none",
              background: color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: !input.trim() || streaming ? 0.3 : 1,
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div style={{ textAlign: "center", padding: "6px 0", background: "#fff" }}>
        <a href={getAppUrl()} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#a1a1aa", textDecoration: "none" }}>
          Powered by <span style={{ fontWeight: 500 }}>Helply</span>
        </a>
      </div>
    </div>
  );
}
