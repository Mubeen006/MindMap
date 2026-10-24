import type { Category, IncompleteItem, ItemDetail, ItemSummary, SearchResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set. Add it to .env.local.");
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let message = `API request failed: ${path} → ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
      else if (Array.isArray(body?.message)) message = body.message.join(", ");
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function adaptItemSummary(raw: any): ItemSummary {
  return {
    ...raw,
    author: raw.author ?? null,
    keyPoints: raw.keyPoints ?? [],
    problemSolved: raw.problemSolved ?? null,
    toolsMentioned: raw.toolsMentioned ?? [],
    setupStepsCount: raw._count?.setupSteps ?? raw.setupSteps?.length ?? 0,
    hasVideo: raw.hasVideo ?? false,
    tags: raw.tags ?? [],
  };
}

function adaptItemDetail(raw: any): ItemDetail {
  const { setupStepsCount: _count, ...summary } = adaptItemSummary(raw);
  return {
    ...summary,
    prerequisites: raw.prerequisites ?? [],
    transcript: raw.transcript ?? null,
    transcriptFormatted: raw.transcriptFormatted ?? null,
    setupSteps: raw.setupSteps ?? [],
    relatedTo: raw.relatedTo ? adaptItemSummary(raw.relatedTo) : null,
    resources: (raw.resources ?? []).map(adaptItemSummary),
  };
}

export async function getItems(categoryId?: string): Promise<ItemSummary[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  const raw = await apiFetch<any[]>(`/items${query}`);
  return raw.map(adaptItemSummary);
}

export async function getItem(id: string): Promise<ItemDetail> {
  const raw = await apiFetch<any>(`/items/${encodeURIComponent(id)}`);
  return adaptItemDetail(raw);
}

export async function getUnlinkedItems(): Promise<ItemSummary[]> {
  const raw = await apiFetch<any[]>("/items/unlinked");
  return raw.map(adaptItemSummary);
}

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}

export async function searchItems(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return apiFetch<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
}

export async function linkResource(resourceId: string, relatedToId: string): Promise<ItemSummary> {
  const raw = await apiFetch<any>(`/items/${encodeURIComponent(resourceId)}/link`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relatedToId }),
  });
  return adaptItemSummary(raw);
}

export async function getIncompleteItems(): Promise<IncompleteItem[]> {
  return apiFetch<IncompleteItem[]>("/items/incomplete");
}

export async function retryItem(id: string): Promise<{ id: string; status: string }> {
  return apiFetch(`/items/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function addResource(itemId: string, url: string): Promise<ItemSummary> {
  const raw = await apiFetch<any>(`/items/${encodeURIComponent(itemId)}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return adaptItemSummary(raw);
}

export interface UpdateItemInput {
  title?: string;
  problemSolved?: string;
  keyPoints?: string[];
  toolsMentioned?: string[];
  prerequisites?: string[];
  tags?: string[];
  categoryId?: string;
  setupSteps?: { text: string; link: string | null }[];
}

export async function updateItem(id: string, dto: UpdateItemInput): Promise<ItemDetail> {
  const raw = await apiFetch<any>(`/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  return adaptItemDetail(raw);
}

export async function deleteItem(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiFetch(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}
