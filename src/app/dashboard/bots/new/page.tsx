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
    <div className="max-w-xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to bots
      </Link>

      <h1 className="text-2xl font-bold mb-2">Create a new bot</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        Give your bot a name and the URL of the page (or sitemap) you want it
        trained on. You can add more pages after creating it.
      </p>

      <form action={onSubmit} className="card p-6 space-y-5">
        <Field
          label="Bot name"
          name="name"
          placeholder="My docs assistant"
          help="Internal name only. Visitors won't see this."
        />
        <Field
          label="Starting URL"
          name="url"
          type="url"
          placeholder="https://example.com/docs"
          help="We'll crawl this page. You can add more URLs later."
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Create bot
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      <input
        required
        name={name}
        type={type}
        placeholder={placeholder}
        className="input"
      />
      {help && <span className="text-xs text-[var(--color-muted)] mt-1.5 block">{help}</span>}
    </label>
  );
}
