"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkResource } from "@/lib/api";
import { ItemSummary } from "@/lib/types";

export function UnlinkedList({ items, reels }: { items: ItemSummary[]; reels: ItemSummary[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  async function handleLink(resourceId: string, reelId: string) {
    if (!reelId) return;
    setPending(resourceId);
    try {
      await linkResource(resourceId, reelId);
      router.refresh();
    } catch {
      alert("Failed to link — please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="space-y-3 max-w-2xl">
      {items.map((item) => (
        <li key={item.id} className="border border-line bg-card rounded-sm p-4">
          <p className="font-body text-sm text-ink">{item.title ?? item.sourceUrl}</p>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-teal hover:underline mt-1 inline-block"
          >
            {item.sourceUrl}
          </a>
          <div className="mt-3 flex items-center gap-2">
            <select
              disabled={pending === item.id}
              onChange={(e) => handleLink(item.id, e.target.value)}
              defaultValue=""
              className="font-mono text-xs border border-line rounded-sm px-2 py-1.5 bg-paper text-ink"
            >
              <option value="" disabled>
                Link to reel…
              </option>
              {reels.map((reel) => (
                <option key={reel.id} value={reel.id}>
                  {reel.title ?? reel.sourceUrl}
                </option>
              ))}
            </select>
            {pending === item.id && <span className="font-mono text-xs text-muted">linking…</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
