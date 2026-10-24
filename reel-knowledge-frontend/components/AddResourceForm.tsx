"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addResource } from "@/lib/api";

export function AddResourceForm({ itemId }: { itemId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Only http:// and https:// links are allowed");
        return;
      }
    } catch {
      setError("That doesn't look like a valid URL");
      return;
    }

    setLoading(true);
    try {
      await addResource(itemId, trimmed);
      setUrl("");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add resource");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          maxLength={2048}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/…"
          className="flex-1 bg-paper border border-line rounded-sm px-3 py-1.5 text-sm font-body text-ink placeholder:text-muted focus-visible:outline-none focus-visible:border-teal"
        />
        <button
          type="submit"
          disabled={loading}
          className="font-mono text-xs px-3 py-1.5 bg-ink text-paper rounded-sm hover:bg-teal transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="font-mono text-xs text-rust mt-1.5">{error}</p>}
    </div>
  );
}
