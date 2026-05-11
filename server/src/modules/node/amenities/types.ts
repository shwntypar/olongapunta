export interface OverpassElement {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

export interface OverpassResponse {
  elements: OverpassElement[];
  remark?: string;
}

export interface ParsedLandmark {
  osmId: string;
  osmType: string;
  lat: number;
  lng: number;
  name: string;
  category: string;
  tags: Record<string, string>;
}

export interface SyncResult {
  ok: boolean;
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  durationMs: number;
  error?: string;
}
