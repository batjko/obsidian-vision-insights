import { App, TFile, Editor, MarkdownView } from 'obsidian';
import { VisionInsightsSettings, ImageInfo, NoteContext } from './types';
import { arrayBufferToBase64, getMimeType } from './utils';

export class ImageHandler {
  constructor(private app: App, private settings: VisionInsightsSettings) {}

  updateSettings(settings: VisionInsightsSettings) {
    this.settings = settings;
  }

  async detectImageAtCursor(editor: Editor, view: MarkdownView): Promise<ImageInfo | null> {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Combined regex for wiki, markdown, and html images
    const imageRegex = /(!\[\[([^\]]+?)\]\])|(!\[[^\]]*?\]\((.*?)\))|(<img[^>]+src=["'](.*?)["'][^>]*>)/g;

    let match;
    while ((match = imageRegex.exec(line)) !== null) {
      const matchText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchText.length;

      // Check if cursor is within the bounds of this match
      if (cursor.ch >= startIndex && cursor.ch <= endIndex) {
        // match[2] is from ![[...]]
        // match[4] is from ![](...)
        // match[6] is from <img src="...">
        const imagePath = match[2] || match[4] || match[6];
        if (imagePath) {
          // Found the image at the cursor
          return this.createImageInfo(decodeURIComponent(imagePath), view);
        }
      }
    }

    return null;
  }

  extractNoteContext(editor: Editor, view: MarkdownView, imageInfo: ImageInfo): NoteContext {
    const noteName = view.file?.basename || 'Untitled';
    const allText = editor.getValue();

    // Find the specific image in the note content
    const imagePattern = this.createImageSearchPattern(imageInfo);
    const match = allText.match(imagePattern);
    
    if (match) {
      const matchIndex = match.index!;
      const matchLength = match[0].length;
      
      // Split content around the actual image
      const textBefore = allText.substring(0, matchIndex).trim();
      const textAfter = allText.substring(matchIndex + matchLength).trim();
      
      const relatedLinks = this.extractRelatedWikiLinks(allText, matchIndex, matchLength, view);
      const sectionData = this.extractSectionData(allText, matchIndex, view);
      const meta = this.extractNoteMetadata(view);
      return {
        textBefore,
        textAfter,
        noteName,
        matchIndex,
        matchLength,
        relatedLinks,
        sectionTitle: sectionData.sectionTitle,
        sectionPath: sectionData.sectionPath,
        sectionText: sectionData.sectionText,
        tags: meta.tags,
        frontmatter: meta.frontmatter
      };
    }

    // Fallback: if we can't find the specific image, return empty context
    console.warn('Vision Insights: Could not locate image in note content for context extraction');
    const relatedLinks = this.extractRelatedWikiLinks(allText, 0, 0, view);
    const sectionData = this.extractSectionData(allText, 0, view);
    const meta = this.extractNoteMetadata(view);
    return {
      textBefore: '',
      textAfter: '',
      noteName,
      relatedLinks,
      sectionTitle: sectionData.sectionTitle,
      sectionPath: sectionData.sectionPath,
      sectionText: sectionData.sectionText,
      tags: meta.tags,
      frontmatter: meta.frontmatter
    };
  }

  private createImageSearchPattern(imageInfo: ImageInfo): RegExp {
    // Create a regex pattern to find this specific image in the markdown content
    // Need to handle different image formats: ![[image.png]], ![](image.png), <img src="image.png">
    
    // Escape special regex characters in the image path/URL
    const escapedPath = imageInfo.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedImagePath = imageInfo.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create patterns for different markdown image formats
    const patterns = [
      `!\\[\\[${escapedPath}\\]\\]`,                    // ![[image.png]]
      `!\\[\\[${escapedImagePath}\\]\\]`,               // ![[path/image.png]]
      `!\\[[^\\]]*?\\]\\(${escapedPath}\\)`,           // ![alt](image.png)
      `!\\[[^\\]]*?\\]\\(${escapedImagePath}\\)`,      // ![alt](path/image.png)
      `<img[^>]+src=["']${escapedPath}["'][^>]*>`,      // <img src="image.png">
      `<img[^>]+src=["']${escapedImagePath}["'][^>]*>`  // <img src="path/image.png">
    ];
    
    // Combine all patterns with OR operator
    return new RegExp(patterns.join('|'), 'i');
  }

  createImageInfoFromFile(file: TFile): ImageInfo | null {
    if (!file) return null;

    return {
      path: file.path,
      url: this.app.vault.getResourcePath(file),
      isExternal: false,
      filename: file.name,
      mimeType: getMimeType(file.extension)
    };
  }

  createImageInfoFromSrc(src: string): ImageInfo | null {
    if (!src) return null;

    try {
      if (src.startsWith('http')) {
        const filename = new URL(src).pathname.split('/').pop() || 'unknown-external';
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        return {
          path: src,
          url: src,
          isExternal: true,
          filename,
          mimeType: getMimeType(extension),
        };
      } else if (src.startsWith('app://')) {
        const url = new URL(src);
        // Pathname is like /<vault-id>/path/to/image.png. We want the part after the vault id.
        const path = decodeURIComponent(url.pathname).split('/').slice(2).join('/');
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          return this.createImageInfoFromFile(file);
        }
      }
    } catch (error) {
      console.error("Vision Insights: Error parsing image src:", src, error);
    }
    
    return null;
  }

  createImageInfo(imagePath: string, view: MarkdownView): ImageInfo | null {
    const isExternal = imagePath.startsWith('http://') || imagePath.startsWith('https://');

    if (isExternal) {
      const filename = imagePath.split('/').pop()?.split('?')[0] || 'unknown-external';
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      return {
        path: imagePath,
        url: imagePath,
        isExternal: true,
        filename,
        mimeType: getMimeType(extension)
      };
    }

    const sourcePath = view.file?.path || '';
    const file = this.app.metadataCache.getFirstLinkpathDest(imagePath, sourcePath);

    if (!file || !(file instanceof TFile)) {
        console.warn(`Vision Insights: Could not resolve image path "${imagePath}" from source "${sourcePath}".`);
        return null;
    }

    return {
      path: file.path,
      url: imagePath,
      isExternal: false,
      filename: file.name,
      mimeType: getMimeType(file.extension)
    };
  }

  async prepareImageForAPI(imageInfo: ImageInfo): Promise<string> {
    if (imageInfo.isExternal) {
      return imageInfo.url;
    }

    // Handle vault images
    const file = this.app.vault.getAbstractFileByPath(imageInfo.path);
    if (!(file instanceof TFile)) {
      throw new Error(`Image file not found: ${imageInfo.path}`);
    }

    const arrayBuffer = await this.app.vault.readBinary(file);
    const base64 = arrayBufferToBase64(arrayBuffer);
    let dataUrl = `data:${imageInfo.mimeType};base64,${base64}`;

    if (this.settings.downscaleImages && this.settings.maxImageDimension && imageInfo.mimeType.startsWith('image/')) {
      try {
        dataUrl = await this.downscaleDataUrl(dataUrl, this.settings.maxImageDimension);
      } catch (e) {
        console.warn('Vision Insights: Downscale failed, using original image.', e);
      }
    }
    return dataUrl;
  }

  private async downscaleDataUrl(dataUrl: string, maxDim: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const largest = Math.max(img.width, img.height);
        const scale = Math.min(1, maxDim / largest);
        if (scale >= 1) return resolve(dataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  extractAllImagesInNote(editor: Editor, view: MarkdownView): Array<{ imageInfo: ImageInfo; noteContext: NoteContext }> {
    const results: Array<{ imageInfo: ImageInfo; noteContext: NoteContext }> = [];
    const content = editor.getValue();
    const noteName = view.file?.basename || 'Untitled';

    const imageRegex = /(!\[\[([^\]]+?)\]\])|(!\[[^\]]*?\]\((.*?)\))|(<img[^>]+src=["'](.*?)["'][^>]*>)/g;
    let match: RegExpExecArray | null;
    while ((match = imageRegex.exec(content)) !== null) {
      const imagePath = match[2] || match[4] || match[6];
      if (!imagePath) continue;
      const info = this.createImageInfo(decodeURIComponent(imagePath), view);
      if (!info) continue;

      const matchIndex = match.index;
      const matchLength = match[0].length;
      const textBefore = content.substring(0, matchIndex).trim();
      const textAfter = content.substring(matchIndex + matchLength).trim();
      const relatedLinks = this.extractRelatedWikiLinks(content, matchIndex, matchLength, view);
      const sectionData = this.extractSectionData(content, matchIndex, view);
      const meta = this.extractNoteMetadata(view);
      const nc: NoteContext = {
        textBefore,
        textAfter,
        noteName,
        matchIndex,
        matchLength,
        relatedLinks,
        sectionTitle: sectionData.sectionTitle,
        sectionPath: sectionData.sectionPath,
        sectionText: sectionData.sectionText,
        tags: meta.tags,
        frontmatter: meta.frontmatter
      };
      results.push({ imageInfo: info, noteContext: nc });
    }
    return results;
  }

  private extractRelatedWikiLinks(allText: string, matchIndex: number, matchLength: number, view: MarkdownView) {
    const windowRadius = 800; // characters around the image
    const start = Math.max(0, matchIndex - windowRadius);
    const end = Math.min(allText.length, matchIndex + matchLength + windowRadius);
    const windowText = allText.slice(start, end);

    // Matches [[link]] or [[link|alias]]
    const linkRegex = /\[\[([^\]|\n]+)(?:\|([^\]]+))?\]\]/g;
    const results: Array<{ linkText: string; path: string; title: string; excerpt: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(windowText)) !== null) {
      const target = m[1].trim();
      const alias = (m[2] || '').trim();
      const sourcePath = view.file?.path || '';
      const file = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      if (!file || !(file instanceof TFile)) continue;

      // Extract small excerpt from the target note (first 200 chars excluding frontmatter)
      // Note: synchronous read is not available; use cached metadata for excerpt if possible
      const cache = this.app.metadataCache.getFileCache(file);
      let excerpt = '';
      if (cache?.sections && cache.sections.length > 0) {
        // Use the first section position to bound excerpt length if available
        excerpt = cache?.headings?.[0]?.heading || '';
      }
      if (!excerpt) {
        excerpt = file.basename;
      }

      results.push({
        linkText: alias || target,
        path: file.path,
        title: file.basename,
        excerpt: excerpt
      });
    }
    return results;
  }

  private extractSectionData(allText: string, anchorIndex: number, view: MarkdownView) {
    // Identify the nearest preceding heading and build the path
    const headingRegex = /^ {0,3}(#{1,6})\s+(.+)$/gm;
    const headings: Array<{ level: number; title: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(allText)) !== null) {
      headings.push({ level: m[1].length, title: m[2].trim(), index: m.index });
    }
    const path: string[] = [];
    let sectionTitle = '';
    let sectionStart = 0;
    let sectionEnd = allText.length;
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (h.index <= anchorIndex) {
        // part of the path
        while (path.length >= h.level) path.pop();
        path.push(h.title);
        sectionTitle = h.title;
        sectionStart = h.index + m?.[0]?.length || h.index; // approximate start of section text
        // end is next heading at same or higher level
        for (let j = i + 1; j < headings.length; j++) {
          if (headings[j].level <= h.level) {
            sectionEnd = headings[j].index;
            break;
          }
        }
      } else {
        break;
      }
    }
    const sectionText = allText.slice(sectionStart, sectionEnd).trim().slice(0, 1200);
    return { sectionTitle, sectionPath: path, sectionText };
  }

  private extractNoteMetadata(view: MarkdownView) {
    const file = view.file;
    const cache = file ? this.app.metadataCache.getFileCache(file) : undefined;
    const frontmatter = (cache as any)?.frontmatter || undefined;
    const tags: string[] = [];
    if (cache?.tags) {
      for (const t of cache.tags) {
        if (t.tag) tags.push(t.tag.replace(/^#/, ''));
      }
    }
    if (cache?.frontmatter && Array.isArray((cache.frontmatter as any).tags)) {
      for (const t of (cache.frontmatter as any).tags) {
        if (typeof t === 'string') tags.push(t.replace(/^#/, ''));
      }
    }
    return { frontmatter, tags };
  }
} 