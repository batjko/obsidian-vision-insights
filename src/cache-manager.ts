import { CacheEntry, ImageInfo, VisionAction, NoteContext } from './types';
import { hashString } from './utils';
import VisionInsightsPlugin from '../main';

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  
  constructor(private plugin: VisionInsightsPlugin) {
    this.loadCache();
  }

  getCachedResult(imageInfo: ImageInfo, action: VisionAction, noteContext?: NoteContext): string | null {
    if (!this.plugin.settings.cacheResults) {
      return null;
    }

    const cacheKey = this.generateCacheKey(imageInfo, action, noteContext);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    const maxAge = this.plugin.settings.maxCacheAge * 60 * 60 * 1000; // Convert hours to ms
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(cacheKey);
      this.saveCache();
      return null;
    }

    return entry.result;
  }

  cacheResult(imageInfo: ImageInfo, action: VisionAction, result: string, noteContext?: NoteContext) {
    if (!this.plugin.settings.cacheResults) {
      return;
    }

    const cacheKey = this.generateCacheKey(imageInfo, action, noteContext);
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      action,
      imageHash: this.hashImageInfo(imageInfo)
    };

    this.cache.set(cacheKey, entry);
    this.saveCache();
  }

  private generateCacheKey(imageInfo: ImageInfo, action: VisionAction, noteContext?: NoteContext): string {
    const imageHash = this.hashImageInfo(imageInfo);
    let key = `${imageHash}-${action}`;
    
    // Include note context in cache key to ensure same image in different contexts gets cached separately
    if (noteContext) {
      const contextHash = this.hashNoteContext(noteContext);
      key += `-${contextHash}`;
    }
    
    return key;
  }

  private hashImageInfo(imageInfo: ImageInfo): string {
    // Create a hash based on image path/url and basic info
    const hashInput = `${imageInfo.path}-${imageInfo.filename}-${imageInfo.mimeType}`;
    return hashString(hashInput);
  }

  private hashNoteContext(noteContext: NoteContext): string {
    // Create a hash based on note context to differentiate same image in different contexts
    const contextInput = `${noteContext.noteName}-${noteContext.textBefore.substring(0, 200)}-${noteContext.textAfter.substring(0, 200)}`;
    return hashString(contextInput);
  }

  clearCache() {
    this.cache.clear();
    this.saveCache();
  }

  getCacheStats() {
    const now = Date.now();
    const maxAge = this.plugin.settings.maxCacheAge * 60 * 60 * 1000;
    
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > maxAge) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return { validEntries, expiredEntries, totalEntries: this.cache.size };
  }

  private async loadCache() {
    try {
      const data = await this.plugin.loadData();
      if (data?.cache) {
        this.cache = new Map(Object.entries(data.cache));
      }
    } catch (error) {
      console.error('Error loading cache:', error);
    }
  }

  private async saveCache() {
    try {
      const data = await this.plugin.loadData() || {};
      data.cache = Object.fromEntries(this.cache);
      await this.plugin.saveData(data);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }
} 