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
      
      return {
        textBefore,
        textAfter,
        noteName
      };
    }

    // Fallback: if we can't find the specific image, return empty context
    console.warn('Vision Insights: Could not locate image in note content for context extraction');
    return {
      textBefore: '',
      textAfter: '',
      noteName
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

  private createImageInfo(imagePath: string, view: MarkdownView): ImageInfo | null {
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
    return `data:${imageInfo.mimeType};base64,${base64}`;
  }
} 