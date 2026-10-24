"use client";

import { useState } from "react";
import { parseFormattedTranscript } from "@/lib/format";

export function TranscriptToggle({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = parseFormattedTranscript(transcript);

  return (
    <div className="mt-6 pt-6 border-t border-line">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-xs text-muted hover:text-teal uppercase"
      >
        {open ? "Hide transcript ▲" : "Show transcript ▼"}
      </button>
      {open && (
        <div className="mt-3">
          {paragraphs.map((segments, pi) => (
            <p key={pi} className="font-body text-sm text-muted leading-relaxed mb-3">
              {segments.map((seg, si) =>
                seg.bold ? (
                  <strong key={si} className="text-ink font-semibold">
                    {seg.text}
                  </strong>
                ) : (
                  <span key={si}>{seg.text}</span>
                ),
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
