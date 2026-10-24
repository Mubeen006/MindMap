"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteItem } from "@/lib/api";

export function DeleteButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this failed item?")) return;
    setLoading(true);
    try {
      await deleteItem(itemId);
      router.refresh();
    } catch {
      alert("Delete failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="font-mono text-xs px-3 py-1.5 border border-line text-muted hover:border-rust hover:text-rust rounded-sm transition-colors disabled:opacity-50 shrink-0"
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
