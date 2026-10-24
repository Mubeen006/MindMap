export type ItemType = "REEL" | "RESOURCE";
export type ProcessingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface Tag {
  id: string;
  name: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  parent: { id: string; name: string } | null;
}

export interface CategoryChild {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface Category extends CategoryChild {
  children: CategoryChild[];
}

export interface SetupStep {
  id: string;
  order: number;
  text: string;
  link: string | null;
}

export interface ItemSummary {
  id: string;
  type: ItemType;
  sourceUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  author?: string | null;
  problemSolved: string | null;
  keyPoints: string[];
  toolsMentioned: string[];
  setupStepsCount: number;
  hasVideo: boolean;
  status: ProcessingStatus;
  createdAt: string;
  category: CategoryRef | null;
  tags: Tag[];
}

export interface ItemDetail extends Omit<ItemSummary, "setupStepsCount"> {
  prerequisites: string[];
  transcript: string | null;
  transcriptFormatted: string | null;
  setupSteps: SetupStep[];
  relatedTo: ItemSummary | null;
  resources: ItemSummary[];
}

export interface SearchResult {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  distance: number;
}

export interface IncompleteItem {
  id: string;
  type: ItemType;
  sourceUrl: string;
  status: ProcessingStatus;
  createdAt: string;
}
