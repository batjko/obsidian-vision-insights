export type VisionAction = 
  | 'smart-summary'
  | 'extract-facts' 
  | 'generate-description'
  | 'identify-text'
  | 'analyze-structure'
  | 'quick-insights'
  | 'analyze-data-viz';

export type InsertionMode = 
  | 'cursor' 
  | 'quote' 
  | 'callout' 
  | 'new-note' 
  | 'daily-note';

export interface VisionInsightsSettings {
  openaiApiKey: string;
  preferredModel: 'gpt-4.1-mini' | 'gpt-4o-mini' | 'gpt-4o';
  enabledActions: VisionAction[];
  defaultInsertionMode: InsertionMode;
  cacheResults: boolean;
  maxCacheAge: number; // in hours
  rateLimitDelay: number; // in milliseconds
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
}

export interface CacheEntry {
  result: string;
  timestamp: number;
  action: VisionAction;
  imageHash: string;
} 