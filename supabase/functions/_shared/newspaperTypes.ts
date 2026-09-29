/** Shared newspaper contract. No credentials or provider response URLs belong here. */
export type NewspaperSectionId = 'chronicle' | 'learning' | 'finance' | 'health' | 'thoughts';
export type ImageProvider = 'grsai' | 'openai' | 'gemini';
export interface NewspaperEntry {
  id: string; source: string; source_id: string; source_url: string;
  title: string; body: string; time?: string; date?: string;
  status: 'completed' | 'planned' | 'recorded'; data?: Record<string, unknown>;
}
export interface NewspaperSection { id: NewspaperSectionId; title: string; items: NewspaperEntry[] }
export interface NewspaperMetric { label: string; value: number; unit: string }
export interface NewspaperSnapshot {
  date: string; timezone: string; day_start_hour: number; captured_at: string;
  sections: NewspaperSection[]; metrics: NewspaperMetric[];
  coverage: Array<{ source: string; state: 'ok' | 'unavailable'; message?: string }>;
  source_fingerprint: string;
}
export interface NewspaperSupplement {
  id: string; report_date: string; body: string; occurred_at: string | null;
  created_at: string; updated_at: string;
}
export interface NewspaperReview {
  overview: string; achievements: string[]; difficulties: string[]; observations: string[];
  suggestions: string[]; source_revision: number; source_fingerprint: string;
  supplements_fingerprint: string; generated_at: string;
}
export interface NewspaperImageOptions {
  provider: ImageProvider; model: string; size: string; quality: string; aspect_ratio: string;
}
export interface NewspaperStyle {
  id: string; name: string; prompt_template: string; is_default: boolean;
  provider: ImageProvider | null; model: string | null; size: string | null;
  quality: string | null; aspect_ratio: string | null; reference_images: string[];
  created_at: string; updated_at: string;
}
export interface NewspaperImageAsset {
  id: string; report_date: string; section_id: NewspaperSectionId | 'main';
  storage_path: string; thumbnail_path: string; width: number; height: number;
  caption: string; active: boolean; prompt: string; style_snapshot: NewspaperStyle | null;
  options: NewspaperImageOptions; source_revision: number; created_at: string;
  /** Short-lived, read-time links, never embedded into portable exports. */
  url?: string; thumbnail_url?: string;
}
export type NewspaperJobStatus = 'queued' | 'submitting' | 'running' | 'saving' | 'succeeded' | 'failed' | 'unknown';
export interface NewspaperImageJob {
  id: string; report_date: string; section_id: NewspaperSectionId | 'main';
  status: NewspaperJobStatus; error: string | null; asset_id: string | null;
  created_at: string; updated_at: string;
}
export interface NewspaperReport {
  id: string; date: string; status: 'draft' | 'archived' | 'reconstructed';
  timezone: string; day_start_hour: number; revision: number; snapshot: NewspaperSnapshot;
  supplements: NewspaperSupplement[]; review: NewspaperReview | null;
  assets: NewspaperImageAsset[]; jobs: NewspaperImageJob[];
  hidden_sections: string[]; source_changed: boolean; source_check_unavailable?: boolean; review_stale: boolean;
  created_at: string; updated_at: string;
}
export interface NewspaperListItem {
  id: string; date: string; status: NewspaperReport['status']; revision: number;
  title: string; excerpt: string; record_count: number; has_image: boolean; has_review: boolean;
  updated_at: string; thumbnail_url?: string;
}
export interface NewspaperPreferences {
  enabled: boolean; enabled_from: string | null; timezone: string; day_start_hour: number;
}
export interface NewspaperImageConfig extends NewspaperImageOptions {
  configured: boolean; key_hint: string | null; base_url: string;
}
/** A service-role client may only be supplied by authenticated server entrypoints. */
export interface NewspaperContext {
  db: any; userId: string; admin?: any;
  permissions: { read: boolean; write: boolean; delete: boolean };
  idempotencyKey?: string; now?: () => Date;
}
export class NewspaperError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message); this.name = 'NewspaperError';
  }
}
