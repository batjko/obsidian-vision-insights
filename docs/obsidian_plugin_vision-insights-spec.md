# Vision Insights Plugin - Design & Implementation Specification

## Executive Summary

The **Vision Insights Plugin** transforms how Obsidian users interact with images in their vault by providing AI-powered analysis through OpenAI's vision models. Instead of a chat interface, the plugin offers predefined, highly useful analysis actions accessible via right-click context menus, optimizing for speed, cost-efficiency, and practical value.

## Current API Landscape

### OpenAI Vision Models (June 2025)
- **Primary Model**: GPT-4.1 mini (recommended for performance)
- **Fallback**: GPT-4o mini for compatibility
- **API**: Chat Completions with multimodal content (`/v1/chat/completions`)
- **Rate Limits**: Standard OpenAI API limits apply
- **Image Formats**: PNG, JPEG, GIF, WebP (base64 encoded for local files)

### Obsidian Plugin API
- **Context Menus**: Available via `workspace.on('editor-menu')` events
- **Image Detection**: DOM inspection for `img` elements and markdown image syntax
- **File Access**: Via `app.vault` interface for local images
- **Settings**: Built-in settings tab integration

## UX Design Philosophy

### Core Principles
1. **Immediate Value**: One-click access to useful image insights
2. **Non-Intrusive**: Seamlessly integrates with existing Obsidian workflow  
3. **Reliable Performance**: Robust error handling and fallback mechanisms
4. **Context Aware**: Results format to match note-taking patterns

### Target User Workflows
- **Researchers**: Extract key information from screenshots, charts, diagrams
- **Students**: Analyze lecture slides, textbook figures, handwritten notes
- **Professionals**: Process meeting whiteboards, flowcharts, documentation screenshots
- **Content Creators**: Generate descriptions and alt-text for accessibility

## Feature Specification

### Context Menu Actions

#### 1. **Smart Summary** 
- **Prompt**: "Provide a concise 2-3 sentence summary of this image's main content, focusing on key information that would be useful in notes."
- **Use Case**: Quick overview for large images or complex diagrams
- **Output**: Plain text summary suitable for inline insertion

#### 2. **Extract Key Facts**
- **Prompt**: "List the most important facts, data points, or information from this image in bullet points. Focus on specific, actionable details."
- **Use Case**: Data extraction from charts, screenshots, infographics
- **Output**: Markdown bullet list ready for note integration

#### 3. **Generate Description**
- **Prompt**: "Write a detailed description of this image suitable for accessibility purposes. Include visual elements, text content, and spatial relationships."
- **Use Case**: Creating alt-text, detailed documentation
- **Output**: Comprehensive description for linking or embedding

#### 4. **Identify Text Content**
- **Prompt**: "Extract and transcribe all readable text from this image, maintaining the original structure and formatting as much as possible."
- **Use Case**: OCR replacement for screenshots, handwritten notes, signs
- **Output**: Plain text with preserved structure

#### 5. **Analyze Structure**
- **Prompt**: "Describe the organizational structure, layout, or workflow shown in this image. Identify main components and their relationships."
- **Use Case**: Flowcharts, org charts, technical diagrams, mind maps
- **Output**: Structured analysis of components and connections

#### 6. **Quick Insights**
- **Prompt**: "Provide 3-5 quick insights or notable observations about this image that might not be immediately obvious."
- **Use Case**: Getting fresh perspectives on familiar content
- **Output**: Numbered list of insights

### Results Integration

#### Modal Display System
```
┌─────────────────────────────────────┐
│ Vision Insights: [Action Name]      │
├─────────────────────────────────────┤
│ 📸 Image: filename.png              │
│                                     │
│ [Generated Content Here]            │
│                                     │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ Insert Note │ │ Copy to Clipboard│ │
│ └─────────────┘ └─────────────────┘ │
│                                     │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ Save to File│ │ Insert as Quote │ │
│ └─────────────┘ └─────────────────┘ │
└─────────────────────────────────────┘
```

#### Smart Insertion Options
1. **Insert at Cursor**: Direct insertion at current cursor position
2. **Insert as Quote**: Wrapped in blockquote with source attribution
3. **Insert as Callout**: Formatted as Obsidian callout with appropriate type
4. **Save as Note**: Create new note with timestamp and source image link
5. **Append to Daily Note**: Add to today's daily note with timestamp

## Technical Implementation

### Project Structure
```
vision-insights/
├── manifest.json
├── main.ts
├── styles.css
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── src/
    ├── types.ts
    ├── settings.ts
    ├── image-handler.ts
    ├── openai-client.ts
    ├── results-modal.ts
    ├── cache-manager.ts
    └── utils.ts
```

### Dependencies & Build Setup

**package.json**:
```json
{
  "name": "vision-insights",
  "version": "1.0.0",
  "description": "AI-powered image analysis for Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^16.11.6",
    "@typescript-eslint/eslint-plugin": "5.29.0",
    "@typescript-eslint/parser": "5.29.0",
    "builtin-modules": "3.3.0",
    "esbuild": "0.17.3",
    "obsidian": "latest",
    "tslib": "2.4.0",
    "typescript": "4.7.4"
  }
}
```

**manifest.json**:
```json
{
  "id": "vision-insights",
  "name": "Vision Insights",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "AI-powered image analysis with contextual insights",
  "author": "Your Name",
  "authorUrl": "https://your-website.com",
  "isDesktopOnly": false
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "declarationMap": true,
    "lib": ["DOM", "ES6"],
    "outDir": ".",
    "typeRoots": ["node_modules/@types"]
  },
  "include": ["**/*.ts"]
}
```

### Type Definitions

**src/types.ts**:
```typescript
export type VisionAction = 
  | 'smart-summary'
  | 'extract-facts' 
  | 'generate-description'
  | 'identify-text'
  | 'analyze-structure'
  | 'quick-insights';

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
```

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Context Menu  │───→│  Image Handler  │───→│  OpenAI Client  │
│    Detection    │    │   & Processor   │    │   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Results UI    │    │  Settings Mgmt  │    │  Cache Manager  │
│    Modal        │    │   & Storage     │    │  & Rate Limit   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Plugin Structure

**main.ts** (Complete Implementation):
```typescript
import { Plugin, Menu, Editor, MarkdownView, Notice } from 'obsidian';
import { VisionInsightsSettings, VisionAction, ImageInfo } from './src/types';
import { ImageHandler } from './src/image-handler';
import { OpenAIClient } from './src/openai-client';
import { ResultsModal } from './src/results-modal';
import { VisionInsightsSettingTab } from './src/settings';
import { CacheManager } from './src/cache-manager';

const DEFAULT_SETTINGS: VisionInsightsSettings = {
  openaiApiKey: '',
  preferredModel: 'gpt-4.1-mini',
  enabledActions: ['smart-summary', 'extract-facts', 'generate-description', 'identify-text', 'analyze-structure', 'quick-insights'],
  defaultInsertionMode: 'cursor',
  cacheResults: true,
  maxCacheAge: 24,
  rateLimitDelay: 500
};

export default class VisionInsightsPlugin extends Plugin {
  settings: VisionInsightsSettings;
  imageHandler: ImageHandler;
  openaiClient: OpenAIClient;
  resultsModal: ResultsModal;
  cacheManager: CacheManager;
  private lastRequestTime = 0;

  async onload() {
    console.log('Loading Vision Insights Plugin');
    
    await this.loadSettings();
    
    // Initialize components
    this.imageHandler = new ImageHandler(this.app, this.settings);
    this.openaiClient = new OpenAIClient(this.settings);
    this.resultsModal = new ResultsModal(this.app, this);
    this.cacheManager = new CacheManager(this);

    // Register context menu handlers
    this.registerContextMenus();
    
    // Add settings tab
    this.addSettingTab(new VisionInsightsSettingTab(this.app, this));

    // Add commands for testing
    this.addCommand({
      id: 'test-vision-analysis',
      name: 'Test Vision Analysis',
      callback: () => new Notice('Vision Insights plugin loaded successfully!')
    });
  }

  onunload() {
    console.log('Unloading Vision Insights Plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update components with new settings
    if (this.openaiClient) {
      this.openaiClient.updateSettings(this.settings);
    }
    if (this.imageHandler) {
      this.imageHandler.updateSettings(this.settings);
    }
  }

  registerContextMenus() {
    // Editor context menu (for markdown view)
    this.registerEvent(
      this.app.workspace.on('editor-menu', this.handleEditorMenu.bind(this))
    );
  }

  async handleEditorMenu(menu: Menu, editor: Editor, view: MarkdownView) {
    const imageInfo = await this.imageHandler.detectImageAtCursor(editor, view);
    if (imageInfo) {
      this.addVisionMenuItems(menu, imageInfo, editor, view);
    }
  }

  addVisionMenuItems(menu: Menu, imageInfo: ImageInfo, editor: Editor, view: MarkdownView) {
    menu.addSeparator();
    
    // Add submenu for vision actions
    menu.addItem((item) => {
      item
        .setTitle('🔍 Vision Insights')
        .setIcon('eye')
        .onClick(() => {
          // Create submenu
          const submenu = new Menu(this.app);
          this.populateVisionSubmenu(submenu, imageInfo, editor, view);
          submenu.showAtMouseEvent(event);
        });
    });
  }

  populateVisionSubmenu(menu: Menu, imageInfo: ImageInfo, editor: Editor, view: MarkdownView) {
    const actionConfigs = [
      { action: 'smart-summary', title: '📝 Smart Summary', icon: 'file-text' },
      { action: 'extract-facts', title: '📊 Extract Key Facts', icon: 'list' },
      { action: 'generate-description', title: '🖼️ Generate Description', icon: 'image' },
      { action: 'identify-text', title: '🔤 Identify Text (OCR)', icon: 'type' },
      { action: 'analyze-structure', title: '🏗️ Analyze Structure', icon: 'network' },
      { action: 'quick-insights', title: '💡 Quick Insights', icon: 'lightbulb' }
    ];

    for (const config of actionConfigs) {
      if (this.settings.enabledActions.includes(config.action as VisionAction)) {
        menu.addItem((item) => {
          item
            .setTitle(config.title)
            .setIcon(config.icon)
            .onClick(() => this.executeVisionAction(config.action as VisionAction, imageInfo, editor, view));
        });
      }
    }
  }

  async executeVisionAction(action: VisionAction, imageInfo: ImageInfo, editor: Editor, view: MarkdownView) {
    try {
      // Rate limiting
      await this.enforceRateLimit();
      
      new Notice(`Analyzing image with ${action.replace('-', ' ')}...`);
      
      // Check cache first
      const cachedResult = this.cacheManager.getCachedResult(imageInfo, action);
      if (cachedResult) {
        this.showResults({
          action,
          content: cachedResult,
          imageInfo,
          timestamp: Date.now(),
          cached: true
        }, editor, view);
        return;
      }

      // Prepare image for API
      const imageData = await this.imageHandler.prepareImageForAPI(imageInfo);
      
      // Call OpenAI API
      const result = await this.openaiClient.analyzeImage(imageData, action);
      
      // Cache the result
      this.cacheManager.cacheResult(imageInfo, action, result);
      
      // Show results
      this.showResults({
        action,
        content: result,
        imageInfo,
        timestamp: Date.now(),
        cached: false
      }, editor, view);
      
    } catch (error) {
      console.error('Vision analysis error:', error);
      new Notice(`Error analyzing image: ${error.message}`);
    }
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.settings.rateLimitDelay) {
      const waitTime = this.settings.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  showResults(result: AnalysisResult, editor: Editor, view: MarkdownView) {
    this.resultsModal.open(result, editor, view);
  }
}
```

### Image Detection & Processing

**src/image-handler.ts** (Complete Implementation):
```typescript
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
    
    // Detect Obsidian image syntax: ![[image.png]]
    const wikiImageMatch = line.match(/!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff))\]\]/gi);
    
    // Detect Markdown image syntax: ![alt](image.png)
    const mdImageMatch = line.match(/!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff))\)/gi);
    
    // Detect HTML img tags
    const htmlImageMatch = line.match(/<img[^>]+src=["']([^"']+\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff))["'][^>]*>/gi);
    
    let imagePath: string | null = null;
    
    if (wikiImageMatch) {
      // Extract path from ![[path]]
      const match = line.match(/!\[\[([^\]]+)\]\]/);
      if (match) imagePath = match[1];
    } else if (mdImageMatch) {
      // Extract path from ![](path)
      const match = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (match) imagePath = match[1];
    } else if (htmlImageMatch) {
      // Extract src from <img src="path">
      const match = line.match(/<img[^>]+src=["']([^"']+)["']/);
      if (match) imagePath = match[1];
    }
    
    if (!imagePath) {
      // Try to detect image at cursor position in preview mode
      return this.detectImageInPreview(cursor, view);
    }
    
    return this.createImageInfo(imagePath, view);
  }

  private detectImageInPreview(cursor: any, view: MarkdownView): ImageInfo | null {
    // This would be implemented for preview mode detection
    // For now, return null as we focus on edit mode
    return null;
  }

  private createImageInfo(imagePath: string, view: MarkdownView): ImageInfo {
    const isExternal = imagePath.startsWith('http://') || imagePath.startsWith('https://');
    const filename = imagePath.split('/').pop() || 'unknown';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (isExternal) {
      return {
        path: imagePath,
        url: imagePath,
        isExternal: true,
        filename,
        mimeType: getMimeType(extension)
      };
    }
    
    // Handle vault-relative paths
    let fullPath = imagePath;
    
    // If path doesn't start with /, it's relative to current note
    if (!imagePath.startsWith('/')) {
      const currentFolder = view.file?.parent?.path || '';
      fullPath = currentFolder ? `${currentFolder}/${imagePath}` : imagePath;
    } else {
      fullPath = imagePath.substring(1); // Remove leading /
    }
    
    return {
      path: fullPath,
      url: imagePath,
      isExternal: false,
      filename,
      mimeType: getMimeType(extension)
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
```

**src/utils.ts** (Helper Functions):
```typescript
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
}

export function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString();
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
```

### OpenAI Integration

**src/openai-client.ts** (Complete Implementation):
```typescript
import { VisionInsightsSettings, VisionAction } from './types';

export class OpenAIClient {
  private baseURL = 'https://api.openai.com/v1';

  constructor(private settings: VisionInsightsSettings) {}

  updateSettings(settings: VisionInsightsSettings) {
    this.settings = settings;
  }

  async analyzeImage(imageData: string, action: VisionAction): Promise<string> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.getPromptForAction(action);
    
    try {
      const response = await this.makeAPICall(imageData, prompt, this.settings.preferredModel);
      return response;
    } catch (error) {
      // Fallback to alternative model if primary fails
      if (error.message.includes('model_not_found') || error.message.includes('model not found')) {
        console.warn(`Model ${this.settings.preferredModel} not found, falling back to gpt-4o-mini`);
        return await this.makeAPICall(imageData, prompt, 'gpt-4o-mini');
      }
      throw error;
    }
  }

  private async makeAPICall(imageData: string, prompt: string, model: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.settings.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: imageData,
                detail: 'auto' // Let OpenAI choose optimal resolution
              }
            }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.1 // Low temperature for consistent results
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    return data.choices[0].message.content;
  }

  private getPromptForAction(action: VisionAction): string {
    const prompts: Record<VisionAction, string> = {
      'smart-summary': "Provide a concise 2-3 sentence summary of this image's main content, focusing on key information that would be useful in notes. Include the most important details and context.",
      
      'extract-facts': "List the most important facts, data points, or information from this image in bullet points. Focus on specific, actionable details that can be referenced later. Include numbers, names, dates, and key concepts.",
      
      'generate-description': "Write a detailed description of this image suitable for accessibility purposes. Include visual elements, text content, spatial relationships, colors, and any notable features. Make it comprehensive enough that someone who can't see the image would understand its content.",
      
      'identify-text': "Extract and transcribe ALL readable text from this image, maintaining the original structure and formatting as much as possible. Include headers, body text, captions, labels, and any other textual content. Preserve line breaks and hierarchical structure.",
      
      'analyze-structure': "Describe the organizational structure, layout, or workflow shown in this image. Identify main components, their relationships, hierarchy, and how they connect to each other. Explain the logical flow or arrangement.",
      
      'quick-insights': "Provide 3-5 quick insights or notable observations about this image that might not be immediately obvious. Look for patterns, implications, interesting details, or connections that add value to understanding the content."
    };
    
    return prompts[action];
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Results Modal & Cache Manager

**src/results-modal.ts** (Complete Implementation):
```typescript
import { App, Modal, Editor, MarkdownView, Setting, Notice } from 'obsidian';
import { AnalysisResult, InsertionMode } from './types';
import VisionInsightsPlugin from '../main';

export class ResultsModal extends Modal {
  private result: AnalysisResult;
  private editor: Editor;
  private view: MarkdownView;

  constructor(app: App, private plugin: VisionInsightsPlugin) {
    super(app);
  }

  open(result: AnalysisResult, editor: Editor, view: MarkdownView) {
    this.result = result;
    this.editor = editor;
    this.view = view;
    super.open();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Title
    contentEl.createEl('h2', { text: `Vision Insights: ${this.getActionTitle(this.result.action)}` });
    
    // Image info
    const imageInfo = contentEl.createDiv('image-info');
    imageInfo.createEl('p', { 
      text: `📸 Image: ${this.result.imageInfo.filename}`,
      cls: 'image-filename'
    });
    
    if (this.result.cached) {
      imageInfo.createEl('span', { 
        text: '⚡ Cached result',
        cls: 'cached-indicator'
      });
    }

    // Results content
    const resultContent = contentEl.createDiv('result-content');
    resultContent.createEl('div', { 
      text: this.result.content,
      cls: 'analysis-result'
    });

    // Action buttons
    const buttonContainer = contentEl.createDiv('button-container');
    
    // Primary actions (top row)
    const primaryRow = buttonContainer.createDiv('button-row');
    
    new Setting(primaryRow)
      .addButton(btn => btn
        .setButtonText('Insert at Cursor')
        .setCta()
        .onClick(() => this.insertResult('cursor')))
      .addButton(btn => btn
        .setButtonText('Copy to Clipboard')
        .onClick(() => this.copyToClipboard()));

    // Secondary actions (bottom row)
    const secondaryRow = buttonContainer.createDiv('button-row');
    
    new Setting(secondaryRow)
      .addButton(btn => btn
        .setButtonText('Insert as Quote')
        .onClick(() => this.insertResult('quote')))
      .addButton(btn => btn
        .setButtonText('Insert as Callout')
        .onClick(() => this.insertResult('callout')))
      .addButton(btn => btn
        .setButtonText('Save to New Note')
        .onClick(() => this.insertResult('new-note')));
  }

  private getActionTitle(action: string): string {
    const titles: Record<string, string> = {
      'smart-summary': 'Smart Summary',
      'extract-facts': 'Key Facts',
      'generate-description': 'Description',
      'identify-text': 'Text Content',
      'analyze-structure': 'Structure Analysis',
      'quick-insights': 'Quick Insights'
    };
    return titles[action] || action;
  }

  private async insertResult(mode: InsertionMode) {
    try {
      const formattedContent = this.formatContent(this.result.content, mode);
      
      switch (mode) {
        case 'cursor':
          this.editor.replaceSelection(formattedContent);
          break;
          
        case 'quote':
          this.editor.replaceSelection(`> ${formattedContent.replace(/\n/g, '\n> ')}\n> \n> *Source: ${this.result.imageInfo.filename}*`);
          break;
          
        case 'callout':
          const calloutType = this.getCalloutType(this.result.action);
          this.editor.replaceSelection(`> [!${calloutType}] ${this.getActionTitle(this.result.action)}\n> ${formattedContent.replace(/\n/g, '\n> ')}`);
          break;
          
        case 'new-note':
          await this.createNewNote();
          break;
          
        case 'daily-note':
          await this.appendToDailyNote();
          break;
      }
      
      new Notice(`Inserted ${this.getActionTitle(this.result.action)} result`);
      this.close();
    } catch (error) {
      new Notice(`Error inserting result: ${error.message}`);
    }
  }

  private formatContent(content: string, mode: InsertionMode): string {
    // Basic formatting - could be enhanced based on mode
    return content.trim();
  }

  private getCalloutType(action: string): string {
    const calloutTypes: Record<string, string> = {
      'smart-summary': 'summary',
      'extract-facts': 'info',
      'generate-description': 'note',
      'identify-text': 'quote',
      'analyze-structure': 'tip',
      'quick-insights': 'example'
    };
    return calloutTypes[action] || 'info';
  }

  private async copyToClipboard() {
    await navigator.clipboard.writeText(this.result.content);
    new Notice('Copied to clipboard');
  }

  private async createNewNote() {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Vision Analysis - ${this.result.imageInfo.filename} - ${timestamp}.md`;
    
    const content = `# Vision Analysis: ${this.getActionTitle(this.result.action)}

**Image:** ${this.result.imageInfo.filename}
**Analysis:** ${this.getActionTitle(this.result.action)}
**Date:** ${new Date().toLocaleDateString()}

## Results

${this.result.content}

---
*Generated by Vision Insights plugin*`;

    await this.app.vault.create(filename, content);
    new Notice(`Created note: ${filename}`);
  }

  private async appendToDailyNote() {
    // This would integrate with daily notes plugin if available
    new Notice('Daily note integration not yet implemented');
  }
}

**src/cache-manager.ts** (Complete Implementation):
```typescript
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
```

### Settings Configuration

**src/settings.ts** (Complete Implementation):
```typescript
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { VisionAction } from './types';
import VisionInsightsPlugin from '../main';

export class VisionInsightsSettingTab extends PluginSettingTab {
  plugin: VisionInsightsPlugin;

  constructor(app: App, plugin: VisionInsightsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h2', { text: 'Vision Insights Settings' });

    // API Configuration
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Your OpenAI API key for vision analysis. Get one at https://platform.openai.com')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.openaiApiKey)
        .onChange(async (value) => {
          this.plugin.settings.openaiApiKey = value;
          await this.plugin.saveSettings();
        }));

    // Test API Key button
    new Setting(containerEl)
      .setName('Test API Key')
      .setDesc('Verify that your API key is valid')
      .addButton(button => button
        .setButtonText('Test Connection')
        .onClick(async () => {
          button.setButtonText('Testing...');
          try {
            const isValid = await this.plugin.openaiClient.validateApiKey();
            if (isValid) {
              new Notice('✅ API key is valid');
            } else {
              new Notice('❌ API key is invalid');
            }
          } catch (error) {
            new Notice(`❌ Error testing API key: ${error.message}`);
          } finally {
            button.setButtonText('Test Connection');
          }
        }));

    // Model Selection
    new Setting(containerEl)
      .setName('Preferred Model')
      .setDesc('Choose the OpenAI model for image analysis. GPT-4.1 mini is recommended for best performance.')
      .addDropdown(dropdown => dropdown
        .addOption('gpt-4.1-mini', 'GPT-4.1 Mini (Recommended)')
        .addOption('gpt-4o-mini', 'GPT-4o Mini')
        .addOption('gpt-4o', 'GPT-4o (Premium)')
        .setValue(this.plugin.settings.preferredModel)
        .onChange(async (value) => {
          this.plugin.settings.preferredModel = value as any;
          await this.plugin.saveSettings();
        }));

    // Enabled Actions
    containerEl.createEl('h3', { text: 'Enabled Actions' });
    containerEl.createEl('p', { 
      text: 'Choose which analysis actions to show in the context menu:',
      cls: 'setting-item-description'
    });

    const actionConfigs = [
      { action: 'smart-summary', title: 'Smart Summary', desc: 'Generate concise summaries of image content' },
      { action: 'extract-facts', title: 'Extract Key Facts', desc: 'List important data points and information' },
      { action: 'generate-description', title: 'Generate Description', desc: 'Create detailed accessibility descriptions' },
      { action: 'identify-text', title: 'Identify Text (OCR)', desc: 'Extract and transcribe readable text' },
      { action: 'analyze-structure', title: 'Analyze Structure', desc: 'Describe layout and organizational structure' },
      { action: 'quick-insights', title: 'Quick Insights', desc: 'Provide notable observations and insights' }
    ];

    for (const config of actionConfigs) {
      new Setting(containerEl)
        .setName(config.title)
        .setDesc(config.desc)
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.enabledActions.includes(config.action as VisionAction))
          .onChange(async (value) => {
            if (value) {
              if (!this.plugin.settings.enabledActions.includes(config.action as VisionAction)) {
                this.plugin.settings.enabledActions.push(config.action as VisionAction);
              }
            } else {
              this.plugin.settings.enabledActions = this.plugin.settings.enabledActions.filter(
                action => action !== config.action
              );
            }
            await this.plugin.saveSettings();
          }));
    }

    // Insertion Behavior
    containerEl.createEl('h3', { text: 'Insertion Behavior' });

    new Setting(containerEl)
      .setName('Default Insertion Mode')
      .setDesc('How to insert analysis results into your notes by default')
      .addDropdown(dropdown => dropdown
        .addOption('cursor', 'At Cursor Position')
        .addOption('quote', 'As Blockquote')
        .addOption('callout', 'As Callout')
        .addOption('new-note', 'Create New Note')
        .addOption('daily-note', 'Append to Daily Note')
        .setValue(this.plugin.settings.defaultInsertionMode)
        .onChange(async (value) => {
          this.plugin.settings.defaultInsertionMode = value as any;
          await this.plugin.saveSettings();
        }));

    // Performance Settings
    containerEl.createEl('h3', { text: 'Performance' });

    new Setting(containerEl)
      .setName('Enable Caching')
      .setDesc('Cache analysis results to avoid repeat API calls for the same image and action')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.cacheResults)
        .onChange(async (value) => {
          this.plugin.settings.cacheResults = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Cache Duration (hours)')
      .setDesc('How long to keep cached results before they expire')
      .addSlider(slider => slider
        .setLimits(1, 168, 1) // 1 hour to 1 week
        .setValue(this.plugin.settings.maxCacheAge)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxCacheAge = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Rate Limit Delay (ms)')
      .setDesc('Minimum delay between API requests to avoid rate limiting')
      .addSlider(slider => slider
        .setLimits(100, 2000, 100)
        .setValue(this.plugin.settings.rateLimitDelay)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.rateLimitDelay = value;
          await this.plugin.saveSettings();
        }));

    // Cache Management
    if (this.plugin.settings.cacheResults) {
      const stats = this.plugin.cacheManager.getCacheStats();
      
      new Setting(containerEl)
        .setName('Cache Statistics')
        .setDesc(`Valid entries: ${stats.validEntries}, Expired: ${stats.expiredEntries}, Total: ${stats.totalEntries}`)
        .addButton(button => button
          .setButtonText('Clear Cache')
          .setWarning()
          .onClick(() => {
            this.plugin.cacheManager.clearCache();
            new Notice('Cache cleared');
            this.display(); // Refresh the display
          }));
    }

    // Add some helpful information
    containerEl.createEl('h3', { text: 'Usage Tips' });
    const tipsContainer = containerEl.createDiv('tips-container');
    tipsContainer.createEl('p', { text: '• Right-click on any image in your notes to access Vision Insights' });
    tipsContainer.createEl('p', { text: '• Works with both [[image.png]] and ![](image.png) syntax' });
    tipsContainer.createEl('p', { text: '• Results can be inserted in multiple formats for different use cases' });
    tipsContainer.createEl('p', { text: '• Enable caching to save on API calls for repeated analysis' });
  }
}
```

### Build Configuration

**esbuild.config.mjs**:
```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === "production");

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

**styles.css**:
```css
/* Vision Insights Plugin Styles */

.vision-insights-modal .modal-content {
  padding: 20px;
  max-width: 600px;
}

.vision-insights-modal .image-info {
  margin-bottom: 15px;
  padding: 10px;
  background-color: var(--background-secondary);
  border-radius: 5px;
}

.vision-insights-modal .image-filename {
  font-weight: bold;
  margin: 0;
}

.vision-insights-modal .cached-indicator {
  color: var(--text-accent);
  font-size: 0.9em;
  margin-left: 10px;
}

.vision-insights-modal .analysis-result {
  padding: 15px;
  margin: 15px 0;
  background-color: var(--background-primary-alt);
  border-radius: 5px;
  border-left: 4px solid var(--interactive-accent);
  white-space: pre-wrap;
  font-family: var(--font-text);
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
}

.vision-insights-modal .button-container {
  margin-top: 20px;
}

.vision-insights-modal .button-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.vision-insights-modal .button-row .setting-item {
  border: none;
  margin: 0;
}

.vision-insights-modal .button-row .setting-item-control {
  justify-content: center;
}

/* Settings page styles */
.tips-container {
  margin-top: 10px;
  padding: 15px;
  background-color: var(--background-secondary);
  border-radius: 5px;
}

.tips-container p {
  margin: 5px 0;
  color: var(--text-muted);
}
```

## Performance Optimization

### Intelligent Caching System
- **Cache Key**: Hash of image content + action type
- **Cache Duration**: Configurable (default: 24 hours)
- **Storage**: Plugin data folder for persistence across sessions
- **Invalidation**: Manual clear option in settings

### Rate Limiting
- **Default Delay**: 500ms between requests
- **Burst Protection**: Maximum 5 requests per minute
- **Queue System**: Queue requests during rate limiting periods

## Security & Privacy

### API Key Management
- **Secure Storage**: Encrypted in Obsidian's plugin data
- **Validation**: Test API key on settings save
- **Error Handling**: Clear error messages for authentication issues

### Data Privacy
- **Local Processing**: Images processed locally before API calls
- **No Data Retention**: OpenAI API configured for zero retention
- **Offline Mode**: Graceful degradation when API unavailable

## Implementation Roadmap

### Phase 1: Core Foundation (Days 1-3)
**Priority: Critical - Must work before proceeding**

1. **Project Setup** (Day 1)
   - [ ] Initialize project structure with all files
   - [ ] Configure TypeScript, esbuild, and dependencies
   - [ ] Create manifest.json and basic plugin scaffolding
   - [ ] Test plugin loads successfully in Obsidian

2. **Core Types & Utils** (Day 1)
   - [ ] Implement types.ts with all interfaces
   - [ ] Implement utils.ts with helper functions
   - [ ] Test image MIME type detection and base64 conversion

3. **Image Detection** (Day 2)
   - [ ] Implement ImageHandler class
   - [ ] Test detection of ![[image.png]] syntax
   - [ ] Test detection of ![](image.png) syntax  
   - [ ] Test detection with various image formats
   - [ ] Test path resolution for vault vs external images

4. **OpenAI Integration** (Day 3)
   - [ ] Implement OpenAIClient class
   - [ ] Test API key validation
   - [ ] Test basic image analysis call
   - [ ] Implement model fallback mechanism
   - [ ] Test error handling for various API failures

### Phase 2: Context Menu & UI (Days 4-5)
**Priority: High - Core UX functionality**

5. **Context Menu Integration** (Day 4)
   - [ ] Implement context menu detection in main.ts
   - [ ] Test right-click menu appears on images
   - [ ] Test submenu population with enabled actions
   - [ ] Test menu does not appear on non-images

6. **Results Modal** (Day 5)
   - [ ] Implement ResultsModal class
   - [ ] Test modal displays analysis results correctly
   - [ ] Test all insertion modes (cursor, quote, callout, new note)
   - [ ] Test copy to clipboard functionality

### Phase 3: Caching & Performance (Days 6-7)
**Priority: Medium - Performance optimization**

7. **Cache Implementation** (Day 6)
   - [ ] Implement CacheManager class
   - [ ] Test cache storage and retrieval
   - [ ] Test cache expiration logic
   - [ ] Test cache persistence across sessions

8. **Rate Limiting** (Day 7)
   - [ ] Implement rate limiting in main plugin
   - [ ] Test delay between requests
   - [ ] Test queue system for rapid requests

### Phase 4: Settings & Polish (Days 8-9)
**Priority: Medium - User configuration**

9. **Settings Interface** (Day 8)
   - [ ] Implement VisionInsightsSettingTab
   - [ ] Test all setting controls work correctly
   - [ ] Test settings persistence
   - [ ] Test API key validation in settings

10. **Error Handling & UX Polish** (Day 9)
    - [ ] Implement comprehensive error handling
    - [ ] Add user-friendly error messages
    - [ ] Test offline behavior
    - [ ] Test various edge cases

### Phase 5: Testing & Documentation (Days 10-11)
**Priority: Critical - Release preparation**

11. **Comprehensive Testing** (Day 10)
    - [ ] Test with various image formats and sizes
    - [ ] Test with external vs vault images
    - [ ] Test all analysis actions
    - [ ] Test plugin in different Obsidian contexts

12. **Documentation & Release Prep** (Day 11)
    - [ ] Create README.md with usage instructions
    - [ ] Test plugin package creation
    - [ ] Prepare for community plugin submission

## Testing Strategy

### Unit Testing Checklist

**Image Detection Tests:**
```typescript
// Test cases to implement
describe('ImageHandler', () => {
  test('detects wiki-style image syntax', () => {
    // Test: ![[image.png]] detection
  });
  
  test('detects markdown image syntax', () => {
    // Test: ![alt](image.png) detection
  });
  
  test('handles external URLs', () => {
    // Test: https://example.com/image.jpg
  });
  
  test('resolves vault relative paths', () => {
    // Test: ./images/photo.png
  });
  
  test('returns null for non-images', () => {
    // Test: regular text lines
  });
});
```

**OpenAI Client Tests:**
```typescript
describe('OpenAIClient', () => {
  test('validates API key correctly', () => {
    // Test valid and invalid API keys
  });
  
  test('handles model fallback', () => {
    // Test primary model failure -> fallback
  });
  
  test('formats prompts correctly', () => {
    // Test all action types generate correct prompts
  });
  
  test('handles API errors gracefully', () => {
    // Test rate limits, network errors, etc.
  });
});
```

### Integration Testing

**Context Menu Integration:**
- Right-click on images in edit mode
- Verify submenu appears with correct actions
- Test action execution triggers API calls
- Verify results modal displays correctly

**Settings Integration:**
- Change API key and verify validation
- Toggle actions and verify context menu updates
- Modify cache settings and verify behavior changes

### Manual Testing Scenarios

1. **Basic Workflow:**
   - Paste image into note
   - Right-click → Vision Insights → Smart Summary
   - Verify results appear in modal
   - Insert at cursor position
   - Verify content inserted correctly

2. **Cache Testing:**
   - Analyze same image twice with same action
   - Verify second call uses cache (faster response)
   - Wait for cache expiration and verify fresh API call

3. **Error Handling:**
   - Use invalid API key
   - Test with corrupted image files
   - Test with unsupported file formats
   - Test with very large images

4. **Performance Testing:**
   - Test with multiple rapid requests
   - Verify rate limiting works
   - Test with various image sizes
   - Monitor memory usage with large images

## Implementation Guidelines for LLM Agents

### Code Organization Rules
1. **Follow the exact file structure** specified above
2. **Implement complete files** - don't leave placeholder functions
3. **Include comprehensive error handling** in every method
4. **Use TypeScript strictly** - define all types and interfaces
5. **Follow Obsidian API patterns** - use provided examples as templates

### Critical Implementation Notes
1. **Image Path Resolution:** Handle both `![[image.png]]` and `![](image.png)` syntax correctly
2. **Base64 Encoding:** Use the exact arrayBufferToBase64 function provided
3. **OpenAI API Format:** Follow the exact JSON structure for multimodal requests
4. **Context Menu Integration:** Use the specific Obsidian events (`editor-menu`)
5. **Settings Persistence:** Use plugin.loadData() and plugin.saveData() correctly

### Testing Requirements
- Test every public method with valid and invalid inputs
- Test UI components in actual Obsidian environment
- Verify API integration with real OpenAI endpoints
- Test caching behavior across plugin reloads

### Success Criteria
- Plugin loads without errors in Obsidian
- Context menu appears on images and triggers analysis
- All 6 analysis actions work correctly
- Results can be inserted in all 5 modes
- Settings save and load correctly
- Caching reduces API calls for repeated requests

This comprehensive specification provides everything needed for an LLM coding agent to implement a fully functional Vision Insights plugin for Obsidian.