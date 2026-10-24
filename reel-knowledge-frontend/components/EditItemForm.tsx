"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItem } from "@/lib/api";
import { ItemDetail, Category } from "@/lib/types";
import { flattenCategories } from "@/lib/categories";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function EditItemForm({
  item,
  categories,
  onDone,
}: {
  item: ItemDetail;
  categories: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title ?? "");
  const [problemSolved, setProblemSolved] = useState(item.problemSolved ?? "");
  const [keyPoints, setKeyPoints] = useState(item.keyPoints.join("\n"));
  const [toolsMentioned, setToolsMentioned] = useState(item.toolsMentioned.join("\n"));
  const [prerequisites, setPrerequisites] = useState(item.prerequisites.join("\n"));
  const [tags, setTags] = useState(item.tags.map((t) => t.name).join("\n"));
  const [setupSteps, setSetupSteps] = useState(
    item.setupSteps.map((s) => (s.link ? `${s.text} | ${s.link}` : s.text)).join("\n"),
  );
  const [categoryId, setCategoryId] = useState(item.category?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatCategories = flattenCategories(categories);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateItem(item.id, {
        title: title.trim(),
        problemSolved: problemSolved.trim(),
        keyPoints: linesToArray(keyPoints),
        toolsMentioned: linesToArray(toolsMentioned),
        prerequisites: linesToArray(prerequisites),
        tags: linesToArray(tags),
        categoryId,
        setupSteps: linesToArray(setupSteps).map((line) => {
          const [text, link] = line.split("|").map((p) => p.trim());
          return { text, link: link || null };
        }),
      });
      router.refresh();
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "w-full mt-1 bg-paper border border-line rounded-sm px-3 py-2 text-sm font-body text-ink " +
    "focus-visible:outline-none focus-visible:border-teal";
  const labelClass = "font-mono text-xs text-muted uppercase";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Problem solved</label>
        <textarea
          value={problemSolved}
          onChange={(e) => setProblemSolved(e.target.value)}
          maxLength={500}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${fieldClass} font-mono`}
        >
          <option value="">Uncategorized</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Key points (one per line)</label>
        <textarea value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} rows={4} className={fieldClass} />
      </div>

      <div>
        <label className={labelClass}>Tools mentioned (one per line)</label>
        <textarea
          value={toolsMentioned}
          onChange={(e) => setToolsMentioned(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Setup steps (one per line — add &quot; | link&quot; for an optional URL)
        </label>
        <textarea
          value={setupSteps}
          onChange={(e) => setSetupSteps(e.target.value)}
          rows={3}
          placeholder="Install the plugin | https://github.com/..."
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Before you start (one per line)</label>
        <textarea
          value={prerequisites}
          onChange={(e) => setPrerequisites(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Tags (one per line)</label>
        <textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={2} className={fieldClass} />
      </div>

      {error && <p className="font-mono text-xs text-rust">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="font-mono text-xs px-4 py-2 bg-teal text-card rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="font-mono text-xs px-4 py-2 border border-line text-muted rounded-sm hover:border-teal"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
