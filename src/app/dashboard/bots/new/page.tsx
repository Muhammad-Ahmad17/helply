"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createBot } from "@/app/dashboard/actions";

export default function NewBotPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await createBot(formData);
    if (result && "error" in result) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs mb-8 transition-colors"
        style={{ color: "var(--fg-muted)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>

      <h1 className="text-xl font-medium tracking-tight mb-1" style={{ color: "var(--fg)" }}>
        New bot
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--fg-secondary)" }}>
        Name it and point it at a URL to crawl.
      </p>

      <form action={onSubmit} className="card p-6 space-y-5 anim-fade-up">
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
            Name
          </label>
          <input required name="name" placeholder="My docs assistant" className="input" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
            Starting URL
          </label>
          <input required name="url" type="url" placeholder="https://example.com/docs" className="input" />
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
