import { CacheEntry, ImageInfo, VisionAction } from './types';
import { hashString } from './utils';
import VisionInsightsPlugin from '../main';

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  
  constructor(private plugin: VisionInsightsPlugin) {
    this.loadCache();
  }

  getCachedResult(imageInfo: ImageInfo, action: VisionAction): string | null {
    if (!this.plugin.settings.cacheResults) {
      return null;
    }

    const cacheKey = this.generateCacheKey(imageInfo, action);
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

  cacheResult(imageInfo: ImageInfo, action: VisionAction, result: string) {
    if (!this.plugin.settings.cacheResults) {
      return;
    }

    const cacheKey = this.generateCacheKey(imageInfo, action);
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      action,
      imageHash: this.hashImageInfo(imageInfo)
    };

    this.cache.set(cacheKey, entry);
    this.saveCache();
  }

  private generateCacheKey(imageInfo: ImageInfo, action: VisionAction): string {
    const imageHash = this.hashImageInfo(imageInfo);
    return `${imageHash}-${action}`;
  }

  private hashImageInfo(imageInfo: ImageInfo): string {
    // Create a hash based on image path/url and basic info
    const hashInput = `${imageInfo.path}-${imageInfo.filename}-${imageInfo.mimeType}`;
    return hashString(hashInput);
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