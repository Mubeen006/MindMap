"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryItem } from "@/lib/api";

export function RetryButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRetry() {
    setLoading(true);
    try {
      await retryItem(itemId);
      router.refresh();
    } catch {
      alert("Retry failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="font-mono text-xs px-3 py-1.5 border border-rust text-rust rounded-sm hover:bg-rust hover:text-card transition-colors disabled:opacity-50 shrink-0"
    >
      {loading ? "Retrying…" : "Retry"}
    </button>
  );
}
