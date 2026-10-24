import Link from "next/link";
import { getIncompleteItems } from "@/lib/api";

export async function IncompleteBanner() {
  const items = await getIncompleteItems();
  if (items.length === 0) return null;

  const failedCount = items.filter((i) => i.status === "FAILED").length;
  const processingCount = items.length - failedCount;

  return (
    <div className="border border-line bg-card rounded-sm px-4 py-3 font-mono text-xs text-muted flex items-center gap-3">
      {processingCount > 0 && <span>{processingCount} processing…</span>}
      {failedCount > 0 && (
        <span className="text-rust">
          {failedCount} failed —{" "}
          <Link href="/incomplete" className="underline hover:text-teal">
            view
          </Link>
        </span>
      )}
    </div>
  );
}
