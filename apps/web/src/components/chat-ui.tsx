"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Bot as BotIcon } from "lucide-react";
import { getAppUrl } from "@/lib/utils";
import type { ChatMessage } from "@ragify/core/types";

const VID_KEY = "ragify-vid";
const LEGACY_VID_KEY = "helply-vid";

function makeVisitorId() {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(VID_KEY) ?? localStorage.getItem(LEGACY_VID_KEY);
  if (!id) {
    id = crypto.randomUUID();
  }
  localStorage.setItem(VID_KEY, id);
  return id;
}

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: color, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatUI({
  botId,
  botName,
  welcome,
  color,
  starterQuestions = [],
}: {
  botId: string;
  botName: string;
  welcome: string;
  color: string;
  starterQuestions?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: welcome }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const vid = useRef("");

  const defaults =
    starterQuestions.length > 0
      ? starterQuestions
      : [`What can you tell me about ${botName}?`, "What topics do you know about?"];

  useEffect(() => {
    vid.current = makeVisitorId();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    setInput("");
    setStreaming(true);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const apiBase = typeof window !== "undefined" ? window.location.origin : getAppUrl();
      const history = messages
        .filter((m) => m.content.trim() && !m.content.startsWith("Something went wrong"))
        .slice(-10);

      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId,
          visitorId: vid.current,
          messages: [...history, { role: "user" as const, content: text }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((p) => {
          const o = [...p];
          o[o.length - 1] = { role: "assistant", content: acc };
          return o;
        });
      }
    } catch (err) {
      setMessages((p) => {
        const o = [...p];
        o[o.length - 1] = {
          role: "assistant",
          content:
            "Something went wrong. Please try again." +
            (err instanceof Error ? ` (${err.message})` : ""),
        };
        return o;
      });
    } finally {
      setStreaming(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input.trim());
  }

  const showStarters = messages.length === 1 && !streaming;

  return (
    <div className="flex flex-col h-screen w-screen" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
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
        <button
          onClick={() =>
            window.parent.postMessage({ ragify: true, helply: true, type: "close" }, "*")
          }
          className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background: "#fafafa" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && streaming && i === messages.length - 1 && !m.content ? (
              <TypingDots color={color} />
            ) : (
              <div
                className="max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                style={
                  m.role === "user"
                    ? { background: color, color: "#fff", borderRadius: "10px 10px 2px 10px" }
                    : {
                        background: "#fff",
                        color: "#27272a",
                        borderRadius: "10px 10px 10px 2px",
                        border: "1px solid #e4e4e7",
                      }
                }
              >
                {m.content || null}
              </div>
            )}
          </div>
        ))}

        {showStarters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {defaults.slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                className="text-left text-xs px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
                style={{ background: "#fff", border: "1px solid #e4e4e7", color: "#525252" }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

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
        <a
          href={getAppUrl()}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 10, color: "#a1a1aa", textDecoration: "none" }}
        >
          Powered by <span style={{ fontWeight: 500, color: "#10b981" }}>Ragify</span>
        </a>
      </div>
    </div>
  );
}
