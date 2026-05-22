"use client";

/** Cursor-style product mockup: browser chrome + Helply dashboard + chat widget */
export function ProductDemo() {
  return (
    <div className="demo-frame w-full max-w-5xl mx-auto anim-fade-up delay-3">
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: "var(--demo-surface)", borderBottom: "1px solid var(--demo-border)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div
          className="flex-1 mx-4 h-7 rounded-md flex items-center justify-center text-[11px] font-mono"
          style={{ background: "var(--demo-bg)", color: "var(--demo-muted)" }}
        >
          helply.aamad.app/dashboard
        </div>
      </div>

      <div className="flex" style={{ background: "var(--demo-bg)", minHeight: 420 }}>
        <div
          className="hidden sm:flex flex-col w-52 shrink-0 p-3 gap-1"
          style={{ borderRight: "1px solid var(--demo-border)" }}
        >
          <div className="text-[10px] uppercase tracking-wider px-2 py-1" style={{ color: "var(--demo-muted)" }}>
            Bots
          </div>
          <SidebarItem active label="Tailwind docs" />
          <SidebarItem label="Stripe API" />
          <SidebarItem label="Product FAQ" />
          <div className="mt-auto pt-3">
            <div
              className="text-[11px] px-2 py-1.5 rounded-md"
              style={{ color: "var(--demo-muted)", background: "var(--demo-surface)" }}
            >
              + New bot
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--demo-fg)" }}>
                Tailwind docs
              </p>
              <p className="text-[11px]" style={{ color: "var(--demo-muted)" }}>
                847 chunks indexed · 12 sources
              </p>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--glow)", color: "var(--demo-fg)" }}
            >
              Ready
            </span>
          </div>

          <div
            className="rounded-lg p-3 mb-4 font-mono text-[11px] leading-relaxed overflow-x-auto"
            style={{
              background: "var(--demo-surface)",
              border: "1px solid var(--demo-border)",
              color: "var(--demo-code)",
            }}
          >
            {"<script src=\"https://helply.aamad.app/api/widget.js\" data-bot=\"abc123\" defer></script>"}
          </div>

          <div
            className="rounded-lg overflow-hidden relative"
            style={{ border: "1px solid var(--demo-border)", background: "#fff", minHeight: 200 }}
          >
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-200" />
              <div className="h-2 w-24 bg-zinc-100 rounded" />
              <div className="h-2 w-16 bg-zinc-100 rounded ml-auto" />
            </div>
            <div className="p-6 space-y-2">
              <div className="h-3 w-2/3 bg-zinc-100 rounded" />
              <div className="h-2 w-full bg-zinc-50 rounded" />
              <div className="h-2 w-5/6 bg-zinc-50 rounded" />
              <div className="h-2 w-4/6 bg-zinc-50 rounded" />
            </div>

            <div className="absolute bottom-4 right-4 w-72 rounded-xl overflow-hidden shadow-2xl border border-zinc-200">
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "#171717" }}>
                <div className="w-6 h-6 rounded-md bg-white/10" />
                <span className="text-white text-xs font-medium">Tailwind docs</span>
              </div>
              <div className="bg-[#fafafa] p-3 space-y-2">
                <Bubble side="bot">How can I help you today?</Bubble>
                <Bubble side="user">How do I install Tailwind?</Bubble>
                <Bubble side="bot">
                  Run <code className="text-[10px] bg-zinc-200 px-1 rounded font-mono">npm install tailwindcss</code> then add the directives to your CSS file.
                </Bubble>
              </div>
              <div className="bg-white px-3 py-2 border-t border-zinc-100 flex gap-2">
                <div className="flex-1 h-7 bg-zinc-100 rounded-md" />
                <div className="w-7 h-7 rounded-md" style={{ background: "#171717" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className="text-[12px] px-2 py-1.5 rounded-md truncate"
      style={{
        color: active ? "var(--demo-fg)" : "var(--demo-muted)",
        background: active ? "var(--demo-surface)" : "transparent",
      }}
    >
      {label}
    </div>
  );
}

function Bubble({ side, children }: { side: "user" | "bot"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] px-2.5 py-1.5 rounded-lg text-[10px] leading-relaxed"
        style={
          side === "user"
            ? { background: "#171717", color: "#fff", borderRadius: "8px 8px 2px 8px" }
            : { background: "#fff", color: "#27272a", border: "1px solid #e4e4e7", borderRadius: "8px 8px 8px 2px" }
        }
      >
        {children}
      </div>
    </div>
  );
}
