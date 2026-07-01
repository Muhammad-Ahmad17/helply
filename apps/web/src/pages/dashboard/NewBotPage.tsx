import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createBot } from "@/lib/bots";

export default function NewBotPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name"));

    setSubmitting(true);
    setError(null);
    const token = await getToken();
    if (!token) {
      setError("Not authenticated");
      setSubmitting(false);
      return;
    }
    const result = await createBot(token, name);
    if ("error" in result && result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    if ("bot" in result && result.bot) {
      navigate(`/dashboard/bots/${result.bot.id}?tab=sources`);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs mb-8" style={{ color: "var(--fg-muted)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>
      <h1 className="text-xl font-medium tracking-tight mb-1" style={{ color: "var(--fg)" }}>New bot</h1>
      <p className="text-sm mb-8" style={{ color: "var(--fg-secondary)" }}>
        Give it a name, then add context as a URL, text, or PDF on the next screen.
      </p>
      <form onSubmit={onSubmit} className="card p-6 space-y-5 anim-fade-up">
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>Bot name</label>
          <input required name="name" placeholder="My assistant" className="input" autoFocus />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create bot
        </button>
      </form>
    </div>
  );
}
