export type VisionAction = 
  | 'smart-summary'
  | 'extract-facts' 
  | 'generate-description'
  | 'identify-text'
  | 'analyze-structure'
  | 'quick-insights'
  | 'analyze-data-viz'
  | 'analyze-diagram'
  | 'extract-meeting-participants'
  | 'analyze-meeting-content'
  | 'custom-vision';

export type InsertionMode = 
  | 'cursor' 
  | 'quote' 
  | 'callout' 
  | 'new-note' 
  | 'daily-note'
  | 'above-image'
  | 'below-image'
  | 'replace-image-callout';

export type VisionModel =
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'gpt-5.2';

export interface NoteContext {
  textBefore: string;
  textAfter: string;
  noteName: string;
  matchIndex?: number;
  matchLength?: number;
  relatedLinks?: Array<{
    linkText: string; // original link text or alias
    path: string; // resolved vault path
    title: string; // file basename
    excerpt: string; // short excerpt from the note
  }>;
  sectionTitle?: string;
  sectionPath?: string[]; // hierarchical path of headings leading to this image
  sectionText?: string; // text of the current section
  tags?: string[];
  frontmatter?: Record<string, any>;
}

export interface VisionInsightsSettings {
  openaiApiKey: string;
  preferredModel: VisionModel;
  enabledActions: VisionAction[];
  hasMigratedAnalyzeDiagramAction?: boolean;
  defaultInsertionMode: InsertionMode;
  cacheResults: boolean;
  maxCacheAge: number; // in hours
  rateLimitDelay: number; // in milliseconds
  // Formatting and output
  outputLanguage?: string; // e.g., 'auto' | 'en' | 'de' | 'fr'
  maxOutputTokens?: number; // overrides default max tokens per request
  includeImageLink?: boolean; // include link to image on insert
  // Per-action behavior overrides
  perActionConfig?: Partial<Record<VisionAction, {
    model?: VisionModel;
    temperature?: number;
    imageDetail?: 'low' | 'auto' | 'high';
    defaultInsertionMode?: InsertionMode;
  }>>;
  // Performance
  downscaleImages?: boolean;
  maxImageDimension?: number; // px
  // Cache size
  maxCacheEntries?: number; // LRU bound
}

export interface ImageInfo {
  path: string;
  url: string;
  isExternal: boolean;
  filename: string;
  mimeType: string;
}

export interface AnalysisResult {
  action: VisionAction;
  content: string;
  imageInfo: ImageInfo;
  timestamp: number;
  cached: boolean;
  noteContext?: NoteContext;
  customPrompt?: string;
  modelUsed?: string;
  tokens?: number;
}

export interface CacheEntry {
  result: string;
  timestamp: number;
  action: VisionAction;
  imageHash: string;
} 

export interface CustomPromptOptions {
  userPrompt: string;
}