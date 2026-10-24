export interface TextSegment {
  text: string;
  bold: boolean;
}

export function parseFormattedTranscript(raw: string): TextSegment[][] {
  const paragraphs = raw.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return paragraphs.map((para) => {
    const segments: TextSegment[] = [];
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith("**") && part.endsWith("**")) {
        segments.push({ text: part.slice(2, -2), bold: true });
      } else {
        segments.push({ text: part, bold: false });
      }
    }
    return segments;
  });
}

export function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
