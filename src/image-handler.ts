import { App, TFile, Editor, MarkdownView } from 'obsidian';
import { VisionInsightsSettings, ImageInfo } from './types';
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