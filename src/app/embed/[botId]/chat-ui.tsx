"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Bot as BotIcon, Loader2 } from "lucide-react";
import { getAppUrl } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

function makeVisitorId() {
  const KEY = "helply-visitor-id";
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function ChatUI({
  botId,
  botName,
  welcome,
  color,
}: {
  botId: string;
  botName: string;
  welcome: string;
  color: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: welcome },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visitorIdRef = useRef<string>("");

  useEffect(() => {
    visitorIdRef.current = makeVisitorId();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setStreaming(true);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${getAppUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId,
          visitorId: visitorIdRef.current,
          messages: nextMessages,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const out = [...prev];
          out[out.length - 1] = { role: "assistant", content: acc };
          return out;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const out = [...prev];
        out[out.length - 1] = {
          role: "assistant",
          content:
            "Sorry — something went wrong on our end. Please try again in a moment." +
            (err instanceof Error ? ` (${err.message})` : ""),
        };
        return out;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-white">
      <header
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: color }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <BotIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{botName}</p>
            <p className="text-xs opacity-80 leading-tight">Online · usually replies instantly</p>
          </div>
        </div>
        <button
          onClick={() => window.parent.postMessage({ helply: true, type: "close" }, "*")}
          className="p-1 rounded hover:bg-white/10"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ background: "#fafafa" }}
      >
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} color={color} />
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center gap-1 px-3 py-2 text-xs text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 px-3 py-3 border-t border-zinc-200 bg-white"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 h-10 px-3 rounded-full bg-zinc-100 text-sm outline-none focus:bg-white focus:ring-2"
          style={{ ["--tw-ring-color" as string]: color }}
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40"
          style={{ background: color }}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <p className="text-[10px] text-center text-zinc-400 pb-2">
        Powered by{" "}
        <a
          href={getAppUrl()}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Helply
        </a>
      </p>
    </div>
  );
}

function Bubble({
  role,
  content,
  color,
}: {
  role: "user" | "assistant";
  content: string;
  color: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
          isUser ? "text-white rounded-br-sm" : "bg-white text-zinc-900 rounded-bl-sm border border-zinc-200"
        }`}
        style={isUser ? { background: color } : undefined}
      >
        {content || <span className="opacity-40">…</span>}
      </div>
    </div>
  );
}
