import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, X, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { Source } from "@ragify/core/types";

const DISMISS_KEY = (botId: string) => `ragify-setup-dismissed-${botId}`;

export function getSetupFlags(botId: string) {
  return {
    embedCopied: localStorage.getItem(`ragify-embed-copied-${botId}`) === "1",
    previewOpened: localStorage.getItem(`ragify-preview-opened-${botId}`) === "1",
    settingsVisited: localStorage.getItem(`ragify-settings-visited-${botId}`) === "1",
  };
}

export function markSetupFlag(botId: string, flag: "embedCopied" | "previewOpened" | "settingsVisited") {
  const keys = {
    embedCopied: `ragify-embed-copied-${botId}`,
    previewOpened: `ragify-preview-opened-${botId}`,
    settingsVisited: `ragify-settings-visited-${botId}`,
  };
  localStorage.setItem(keys[flag], "1");
}

type Step = {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
};

export function SetupChecklist({
  botId,
  sources,
  chunkCount,
  onGoToTab,
}: {
  botId: string;
  sources: Source[];
  chunkCount: number;
  onGoToTab: (tab: "sources" | "embed" | "settings" | "chats") => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [flags, setFlags] = useState(getSetupFlags(botId));

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY(botId)) === "1");
    setFlags(getSetupFlags(botId));
  }, [botId, sources.length, chunkCount]);

  const hasSource = sources.length > 0;
  const hasReady = sources.some((s) => s.status === "ready");
  const allCoreDone = hasSource && hasReady && flags.embedCopied && flags.previewOpened;

  const steps: Step[] = useMemo(
    () => [
      { id: "context", label: "Add context (text, URL, or PDF)", done: hasSource },
      { id: "index", label: "Wait for indexing to finish", done: hasReady },
      { id: "customize", label: "Customize welcome message & color", done: flags.settingsVisited, optional: true },
      { id: "copy", label: "Copy embed snippet", done: flags.embedCopied },
      { id: "test", label: "Test chat in preview", done: flags.previewOpened },
    ],
    [hasSource, hasReady, flags]
  );

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  if (dismissed && allCoreDone) return null;
  if (dismissed && !allCoreDone) {
    /* allow re-show via incomplete state — only fully dismiss when live */
  }

  function dismiss() {
    if (allCoreDone) {
      localStorage.setItem(DISMISS_KEY(botId), "1");
      setDismissed(true);
    }
  }

  if (allCoreDone && dismissed) return null;

  return (
    <div
      className="card p-5 mb-6 anim-fade-up"
      style={{ boxShadow: "var(--shadow-card)", borderColor: "var(--accent-muted)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-muted)" }}
          >
            {allCoreDone ? (
              <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
            ) : (
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {progress}%
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
              {allCoreDone ? "You're live!" : "Setup checklist"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {allCoreDone
                ? "Your bot is ready for visitors. Monitor chats and usage anytime."
                : `${completedCount} of ${steps.length} steps complete`}
            </p>
          </div>
        </div>
        {allCoreDone && (
          <button type="button" onClick={dismiss} className="btn btn-ghost h-8 w-8 p-0" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!allCoreDone && (
        <div className="progress-bar mb-4">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <ul className="space-y-1 mb-4">
        {steps.map((step) => (
          <li key={step.id} className="setup-step">
            <span className={`setup-step-icon ${step.done ? "done" : "pending"}`}>
              {step.done ? <Check className="w-3 h-3" /> : ""}
            </span>
            <span
              className="text-sm"
              style={{
                color: step.done ? "var(--fg-muted)" : "var(--fg-secondary)",
                textDecoration: step.done ? "line-through" : "none",
              }}
            >
              {step.label}
              {step.optional && (
                <span className="text-xs ml-1" style={{ color: "var(--fg-muted)" }}>
                  (optional)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {!hasSource && (
          <button type="button" onClick={() => onGoToTab("sources")} className="btn btn-accent text-xs">
            Add context <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
        {hasSource && !hasReady && (
          <button type="button" onClick={() => onGoToTab("sources")} className="btn btn-secondary text-xs">
            View sources
          </button>
        )}
        {hasReady && chunkCount > 0 && !flags.embedCopied && (
          <button type="button" onClick={() => onGoToTab("embed")} className="btn btn-accent text-xs">
            Get embed code <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
        {allCoreDone && (
          <>
            <button type="button" onClick={() => onGoToTab("chats")} className="btn btn-secondary text-xs">
              View chats
            </button>
            <Link to={`/dashboard/bots/${botId}?tab=usage`} className="btn btn-ghost text-xs">
              Usage
            </Link>
          </>
        )}
        {!flags.settingsVisited && hasReady && (
          <button type="button" onClick={() => onGoToTab("settings")} className="btn btn-ghost text-xs">
            Customize bot
          </button>
        )}
      </div>
    </div>
  );
}
