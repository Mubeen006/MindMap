"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { ItemDetail, Category } from "@/lib/types";
import { deleteItem } from "@/lib/api";
import { TranscriptToggle } from "./TranscriptToggle";
import { AddResourceForm } from "./AddResourceForm";
import { EditItemForm } from "./EditItemForm";

export function ItemDetailBody({ item, categories }: { item: ItemDetail; categories: Category[] }) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDeleteReel() {
    const confirmed = window.confirm(
      "Delete this card permanently? This cannot be undone. Any linked resources will be kept but unlinked.",
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      router.push("/");
    } catch {
      alert("Failed to delete — please try again.");
      setBusy(false);
    }
  }

  async function handleRemoveResource(resourceId: string) {
    const confirmed = window.confirm("Remove this linked resource?");
    if (!confirmed) return;
    try {
      await deleteItem(resourceId);
      router.refresh();
    } catch {
      alert("Failed to remove — please try again.");
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display font-bold text-2xl text-ink">{item.title ?? "Untitled"}</h1>
        {mode === "view" && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setMode("edit")}
              className="p-1.5 border border-line rounded-sm text-muted hover:border-teal hover:text-teal"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDeleteReel}
              disabled={busy}
              className="p-1.5 border border-line rounded-sm text-muted hover:border-rust hover:text-rust disabled:opacity-50"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {mode === "edit" ? (
        <div className="mt-4">
          <EditItemForm item={item} categories={categories} onDone={() => setMode("view")} />
        </div>
      ) : (
        <>
          {item.category && (
            <Link
              href={`/category/${item.category.id}`}
              className="font-mono text-xs text-teal hover:underline mt-1 inline-block"
            >
              {item.category.parent
                ? `${item.category.parent.name} › ${item.category.name}`
                : item.category.name}
            </Link>
          )}

          {item.problemSolved && (
            <p className="font-body text-base text-ink mt-4 leading-relaxed border-l-2 border-teal pl-4">
              {item.problemSolved}
            </p>
          )}

          {item.toolsMentioned.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-xs text-muted uppercase mb-1.5">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {item.toolsMentioned.map((tool) => (
                  <span key={tool} className="font-mono text-xs px-2 py-1 bg-teal text-card rounded-sm">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.setupSteps.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-xs text-muted uppercase mb-2">Setup steps</p>
              <ol className="space-y-2">
                {item.setupSteps.map((step) => (
                  <li key={step.id} className="font-body text-sm text-ink flex gap-2">
                    <span className="font-mono text-xs text-rust shrink-0">{step.order + 1}.</span>
                    <span>
                      {step.text}
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 font-mono text-xs text-teal hover:underline"
                        >
                          link ↗
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {item.prerequisites.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-xs text-muted uppercase mb-1.5">Before you start</p>
              <ul className="space-y-1">
                {item.prerequisites.map((req, i) => (
                  <li key={i} className="font-body text-sm text-muted">
                    • {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.keyPoints.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-xs text-muted uppercase mb-1.5">Key points</p>
              <ul className="space-y-2">
                {item.keyPoints.map((point, i) => (
                  <li key={i} className="font-body text-sm text-ink leading-relaxed">
                    • {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="font-mono text-[10px] px-1.5 py-0.5 border border-line text-muted rounded-sm"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block font-mono text-xs text-muted hover:text-teal underline"
          >
            View original ↗
          </a>

          {item.relatedTo && (
            <div className="mt-6 pt-6 border-t border-line">
              <p className="font-mono text-xs text-muted uppercase">Source for</p>
              <Link href={`/item/${item.relatedTo.id}`} className="font-body text-sm text-teal hover:underline">
                {item.relatedTo.title ?? item.relatedTo.sourceUrl}
              </Link>
            </div>
          )}

          {item.type === "REEL" && (
            <div className="mt-6 pt-6 border-t border-line">
              <p className="font-mono text-xs text-muted uppercase mb-2">Linked resources</p>
              {item.resources.length > 0 ? (
                <ul className="space-y-1.5">
                  {item.resources.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-sm text-teal hover:underline truncate"
                      >
                        {r.title ?? r.sourceUrl}
                      </a>
                      <button
                        onClick={() => handleRemoveResource(r.id)}
                        className="font-mono text-[10px] text-muted hover:text-rust shrink-0"
                        aria-label="Remove resource"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-body text-sm text-muted">No resources linked yet.</p>
              )}
              <AddResourceForm itemId={item.id} />
            </div>
          )}

          {item.transcriptFormatted && <TranscriptToggle transcript={item.transcriptFormatted} />}
        </>
      )}
    </div>
  );
}
