import { Plugin, Menu, Editor, MarkdownView, Notice, TFile, MenuItem, TAbstractFile } from 'obsidian';
import { VisionInsightsSettings, VisionAction, ImageInfo, AnalysisResult } from './src/types';
import { ImageHandler } from './src/image-handler';
import { OpenAIClient } from './src/openai-client';
import { ResultsModal } from './src/results-modal';
import { VisionInsightsSettingTab } from './src/settings';
import { CacheManager } from './src/cache-manager';
import { PromptModal } from 'src/prompt-modal';
import { ACTIONS } from './src/action-config';

const DEFAULT_SETTINGS: VisionInsightsSettings = {
  openaiApiKey: '',
  preferredModel: 'gpt-5-mini',
  enabledActions: [
    'smart-summary',
    'extract-facts',
    'generate-description',
    'identify-text',
    'analyze-structure',
    'quick-insights',
    'analyze-data-viz',
    'extract-meeting-participants',
    'analyze-meeting-content',
    'custom-vision'
  ],
  defaultInsertionMode: 'below-image',
  cacheResults: true,
  maxCacheAge: 24,
  rateLimitDelay: 500
};

export default class VisionInsightsPlugin extends Plugin {
  settings!: VisionInsightsSettings;
  imageHandler!: ImageHandler;
  openaiClient!: OpenAIClient;
  resultsModal!: ResultsModal;
  cacheManager!: CacheManager;
  private lastRequestTime: number = 0;
  private contextMenuDebugEnabled: boolean = false;

  async onload(): Promise<void> {
    console.log('Vision Insights: Loading Plugin...');

    try {
      await this.loadSettings();

      this.imageHandler = new ImageHandler(this.app, this.settings);
      this.openaiClient = new OpenAIClient(this.settings);
      this.resultsModal = new ResultsModal(this.app, this);
      this.cacheManager = new CacheManager(this);

      this.registerContextMenus();
      console.log('Vision Insights: Context menu handlers registered.');

      this.addSettingTab(new VisionInsightsSettingTab(this.app, this));
      console.log('Vision Insights: Settings tab added.');

      this.addCommand({
        id: 'test-vision-analysis',
        name: 'Test Vision Analysis',
        callback: () => new Notice('Vision Insights plugin loaded successfully!')
      });
      this.addCommand({
        id: 'toggle-context-menu-debug',
        name: 'Vision: Toggle Context Menu Debug Logging',
        callback: () => this.toggleContextMenuDebugLogging()
      });
      this.addCommand({
        id: 'analyze-all-images-in-note',
        name: 'Vision: Analyze All Images in Current Note…',
        checkCallback: (checking) => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) return false;
          if (!checking) {
            this.analyzeAllImagesInNote(view);
          }
          return true;
        }
      });
      this.addCommandPaletteCommands();
      console.log('Vision Insights: Plugin loaded successfully.');
    } catch (error: any) {
      console.error('Vision Insights: Fatal error during onload:', error);
    }
  }

  onunload(): void {
    console.log('Unloading Vision Insights Plugin');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.migrateLegacyModels();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    if (this.openaiClient) {
      this.openaiClient.updateSettings(this.settings);
    }
    if (this.imageHandler) {
      this.imageHandler.updateSettings(this.settings);
    }
  }

  private migrateLegacyModels(): void {
    const mapLegacyModel = (value?: string): VisionInsightsSettings['preferredModel'] => {
      switch (value) {
        case 'gpt-5-mini':
        case 'gpt-5-nano':
        case 'gpt-5.2':
          return value;
        default:
          return 'gpt-5-mini';
      }
    };

    this.settings.preferredModel = mapLegacyModel(this.settings.preferredModel);

    if (!this.settings.perActionConfig) return;
    for (const actionKey of Object.keys(this.settings.perActionConfig) as VisionAction[]) {
      const actionConfig = this.settings.perActionConfig[actionKey];
      if (!actionConfig?.model) continue;
      actionConfig.model = mapLegacyModel(actionConfig.model);
    }
  }

  registerContextMenus(): void {
    this.registerEvent(
      this.app.workspace.on(
        'editor-menu',
        (menu, editor, view) => {
          this.debugContextMenu('editor-menu fired');
          if (!(view instanceof MarkdownView)) {
            this.debugContextMenu('editor-menu ignored: non-MarkdownView context');
            return;
          }
          this.handleEditorMenu(menu, editor, view);
        }
      )
    );

    this.registerEvent(
      this.app.workspace.on(
        'file-menu',
        (menu: Menu, file: TAbstractFile) => {
          if (
            file instanceof TFile &&
            file.extension.match(/^(png|jpg|jpeg|gif|webp|bmp|tiff)$/i)
          ) {
            this.debugContextMenu('file-menu fired', { filePath: file.path });
            const imageInfo: ImageInfo | null = this.imageHandler.createImageInfoFromFile(file);
            if (imageInfo) {
              const activeView: MarkdownView | null = this.app.workspace.getActiveViewOfType(MarkdownView);
              if (activeView) {
                this.addVisionMenuItems(menu, imageInfo, activeView.editor, activeView);
              }
            }
          }
        }
      )
    );

    this.registerEvent(
      this.app.workspace.on(
        'url-menu',
        (menu: Menu, url: string) => {
          this.debugContextMenu('url-menu fired', { url });
          this.handleUrlMenu(menu, url);
        }
      )
    );

    this.registerDomEvent(
      document,
      'contextmenu',
      (event: MouseEvent) => this.handleRenderedImageContextMenu(event),
      { capture: true }
    );
  }

  addCommandPaletteCommands(): void {
    this.addCommand({
      id: 'vision-custom-prompt',
      name: 'Vision: Custom Prompt for Image…',
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (!checking) {
          const editor = view.editor;
          this.handleEditorMenu(new Menu(), editor, view);
        }
        return true;
      }
    });
  }

  async handleEditorMenu(menu: Menu, editor: Editor, view: MarkdownView): Promise<void> {
    const imageInfo: ImageInfo | null = await this.imageHandler.detectImageAtCursor(editor, view);
    if (imageInfo) {
      this.addVisionMenuItems(menu, imageInfo, editor, view);
    }
  }

  private handleUrlMenu(menu: Menu, url: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      this.debugContextMenu('url-menu ignored: no active markdown view', { url });
      return;
    }

    const imageInfo = this.resolveImageInfoFromUrl(url, activeView);
    if (!imageInfo) {
      this.debugContextMenu('url-menu url did not resolve to image', { url });
      return;
    }

    this.debugContextMenu('url-menu resolved image', { path: imageInfo.path, isExternal: imageInfo.isExternal });
    this.addVisionMenuItems(menu, imageInfo, activeView.editor, activeView);
  }

  private handleRenderedImageContextMenu(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      this.debugContextMenu('dom contextmenu ignored: target not HTMLElement');
      return;
    }

    const composedPath = event.composedPath();
    const pathImage = composedPath.find((node) => node instanceof HTMLImageElement);
    const closestImage = target.closest('img');
    const anchorImage = target.closest('a')?.querySelector('img');
    const imageElement = closestImage || anchorImage;
    const resolvedImageElement = imageElement || pathImage;
    if (!(resolvedImageElement instanceof HTMLImageElement)) {
      this.debugContextMenu('dom contextmenu ignored: no image element in target/path', {
        targetTag: target.tagName,
        targetClass: target.className
      });
      return;
    }

    const isInMarkdownView = !!resolvedImageElement.closest('.markdown-preview-view, .markdown-source-view');
    if (!isInMarkdownView) {
      this.debugContextMenu('dom contextmenu ignored: image not in markdown view');
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      this.debugContextMenu('dom contextmenu ignored: no active markdown view');
      return;
    }

    const imageInfo = this.resolveRenderedImageInfo(resolvedImageElement, activeView);
    if (!imageInfo) {
      this.debugContextMenu('dom contextmenu image could not be resolved', {
        currentSrc: resolvedImageElement.currentSrc,
        src: resolvedImageElement.src,
        dataSrc: resolvedImageElement.dataset.src,
        dataHref: resolvedImageElement.dataset.href,
        anchorHref: resolvedImageElement.closest('a')?.href
      });
      return;
    }

    this.debugContextMenu('dom contextmenu resolved image', { path: imageInfo.path, isExternal: imageInfo.isExternal });
    event.preventDefault();
    event.stopPropagation();

    const menu = new Menu();
    this.addVisionMenuItems(menu, imageInfo, activeView.editor, activeView);
    menu.showAtMouseEvent(event);
  }

  private resolveRenderedImageInfo(imageElement: HTMLImageElement, view: MarkdownView): ImageInfo | null {
    const anchorElement = imageElement.closest('a');
    const sourceCandidates: string[] = [
      imageElement.currentSrc,
      imageElement.src,
      imageElement.dataset.src || '',
      imageElement.dataset.href || '',
      anchorElement?.href || '',
      anchorElement?.dataset.href || ''
    ].filter(Boolean);

    for (const source of sourceCandidates) {
      const directImageInfo = this.imageHandler.createImageInfoFromSrc(source);
      if (directImageInfo) {
        this.debugContextMenu('resolved image from src candidate', { source, path: directImageInfo.path });
        return directImageInfo;
      }

      const normalizedPath = this.extractInternalImagePath(source);
      if (!normalizedPath) continue;
      const internalImageInfo = this.imageHandler.createImageInfo(normalizedPath, view);
      if (internalImageInfo) {
        this.debugContextMenu('resolved image from normalized path', { source, normalizedPath, path: internalImageInfo.path });
        return internalImageInfo;
      }
    }

    return null;
  }

  private resolveImageInfoFromUrl(url: string, view: MarkdownView): ImageInfo | null {
    const source = url?.trim();
    if (!source) {
      this.debugContextMenu('resolveImageInfoFromUrl skipped: empty url');
      return null;
    }

    const fromSrc = this.imageHandler.createImageInfoFromSrc(source);
    if (fromSrc) {
      this.debugContextMenu('resolveImageInfoFromUrl: createImageInfoFromSrc success', { source, path: fromSrc.path });
      return fromSrc;
    }

    const normalizedPath = this.extractInternalImagePath(source);
    if (!normalizedPath) {
      this.debugContextMenu('resolveImageInfoFromUrl: normalized path not available', { source });
      return null;
    }

    const resolved = this.imageHandler.createImageInfo(normalizedPath, view);
    this.debugContextMenu('resolveImageInfoFromUrl: normalized path attempted', {
      source,
      normalizedPath,
      resolved: !!resolved
    });
    return resolved;
  }

  private extractInternalImagePath(rawSource: string): string | null {
    const source = rawSource.trim();
    if (!source) return null;

    if (/^(data|blob|javascript|mailto):/i.test(source)) return null;
    if (/^https?:\/\//i.test(source)) return null;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(source)) return null;

    const withoutHash = source.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const withoutLeadingSlash = withoutQuery.replace(/^\/+/, '').replace(/^\.\//, '');
    if (!withoutLeadingSlash) return null;

    try {
      return decodeURIComponent(withoutLeadingSlash);
    } catch {
      return withoutLeadingSlash;
    }
  }

  private toggleContextMenuDebugLogging(): void {
    this.contextMenuDebugEnabled = !this.contextMenuDebugEnabled;
    new Notice(`Vision Insights context menu debug ${this.contextMenuDebugEnabled ? 'enabled' : 'disabled'}.`);
    this.debugContextMenu('debug logging toggled', { enabled: this.contextMenuDebugEnabled });
  }

  private debugContextMenu(message: string, data?: Record<string, unknown>): void {
    if (!this.contextMenuDebugEnabled) return;
    if (data) {
      console.log(`[Vision Insights][ContextMenuDebug] ${message}`, data);
      return;
    }
    console.log(`[Vision Insights][ContextMenuDebug] ${message}`);
  }

  addVisionMenuItems(
    menu: Menu,
    imageInfo: ImageInfo,
    editor: Editor,
    view: MarkdownView
  ): void {
    if (!this.settings.enabledActions.length) return;

    menu.addSeparator();

    const actionConfigs = (Object.keys(ACTIONS) as VisionAction[]).map(action => ({
      action,
      title: `${ACTIONS[action].title}`,
      icon: ACTIONS[action].icon
    }));

    for (const config of actionConfigs) {
      if (this.settings.enabledActions.includes(config.action)) {
        menu.addItem((item: MenuItem) => {
          item
            .setTitle(config.title)
            .setIcon(config.icon)
            .onClick(async () => {
              if (config.action === 'custom-vision') {
                const prompt = await new Promise<string | null>((resolve: (value: string | null) => void) => {
                  const modal = new PromptModal(this.app, 'Enter custom prompt for vision analysis', (value: string | null) => resolve(value));
                  modal.open();
                });
                if (!prompt) return;
                await this.executeVisionAction(config.action, imageInfo, editor, view, prompt);
              } else {
                await this.executeVisionAction(config.action, imageInfo, editor, view);
              }
            });
        });
      }
    }

    menu.addSeparator();
  }

  async executeVisionAction(
    action: VisionAction,
    imageInfo: ImageInfo,
    editor: Editor,
    view: MarkdownView,
    customPrompt?: string
  ): Promise<void> {
    const loadingNotice = new Notice(
      `Analyzing image with ${action.replace(/-/g, ' ')}...`,
      0
    );

    try {
      await this.enforceRateLimit();

      // Extract note context around the image
      const noteContext = this.imageHandler.extractNoteContext(editor, view, imageInfo);

      const cachedResult: string | null = this.cacheManager.getCachedResult(imageInfo, action, noteContext, customPrompt);
      if (cachedResult) {
        new Notice('Showing cached result.');
        this.showResults(
          {
            action,
            content: cachedResult,
            imageInfo,
            timestamp: Date.now(),
            cached: true,
            noteContext,
            customPrompt
          },
          editor,
          view
        );
        return;
      }

      const imageData: ArrayBuffer | string = await this.imageHandler.prepareImageForAPI(imageInfo);
      const result = await this.openaiClient.analyzeImage(imageData as string, action, noteContext, customPrompt);

      this.cacheManager.cacheResult(imageInfo, action, result.content, noteContext, customPrompt);

      this.showResults(
        {
          action,
          content: result.content,
          imageInfo,
          timestamp: Date.now(),
          cached: false,
          noteContext,
          customPrompt,
          modelUsed: result.modelUsed,
          tokens: result.tokens
        },
        editor,
        view
      );
    } catch (error: any) {
      console.error('Vision analysis error:', error);
      new Notice(`Error analyzing image: ${error.message}`);
    } finally {
      loadingNotice.hide();
    }
  }

  async enforceRateLimit(): Promise<void> {
    const now: number = Date.now();
    const timeSinceLastRequest: number = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.settings.rateLimitDelay) {
      const waitTime: number = this.settings.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  showResults(
    result: AnalysisResult,
    editor: Editor,
    view: MarkdownView
  ): void {
    this.resultsModal.show(result, editor, view);
  }

  private async analyzeAllImagesInNote(view: MarkdownView) {
    let loadingNotice: Notice | null = null;
    try {
      const editor = view.editor;
      const images = this.imageHandler.extractAllImagesInNote(editor, view);
      if (!images.length) {
        new Notice('No images found in this note.');
        return;
      }

      // Ask user for custom prompt; fallback to extract-facts if none
      const customPrompt = await new Promise<string | null>((resolve) => {
        const modal = new PromptModal(this.app, 'Enter custom prompt for bulk vision analysis (applies to all images)', (value: string | null) => resolve(value));
        modal.open();
      });
      const usingCustom = !!(customPrompt && customPrompt.trim());
      const overallAction: VisionAction = usingCustom ? 'custom-vision' : 'extract-facts';

      loadingNotice = new Notice(
        `Analyzing ${images.length} image(s)${usingCustom ? ' with custom instructions' : ' for key information'}…`,
        0
      );

      const analyses: Array<{ filename: string; content: string }> = [];
      let lastModel: string | undefined;
      let lastTokens: number | undefined;
      for (const { imageInfo, noteContext } of images) {
        await this.enforceRateLimit();
        const imageData = await this.imageHandler.prepareImageForAPI(imageInfo);
        const cached = this.cacheManager.getCachedResult(imageInfo, overallAction, noteContext, customPrompt || undefined);
        let content: string;
        if (cached) {
          content = cached;
        } else {
          const res = await this.openaiClient.analyzeImage(imageData, overallAction, noteContext, customPrompt || undefined);
          content = res.content;
          lastModel = res.modelUsed;
          lastTokens = res.tokens;
          this.cacheManager.cacheResult(imageInfo, overallAction, content, noteContext, customPrompt || undefined);
        }
        analyses.push({ filename: imageInfo.filename, content });
      }

      loadingNotice.hide();
      loadingNotice = new Notice('Consolidating results…', 0);
      const firstContext = images[0]?.noteContext;
      const consolidated = await this.openaiClient.consolidateAnalyses(analyses, overallAction, firstContext, customPrompt || undefined);

      const result: AnalysisResult = {
        action: overallAction,
        content: consolidated.content,
        imageInfo: images[0].imageInfo,
        timestamp: Date.now(),
        cached: false,
        noteContext: firstContext,
        customPrompt: customPrompt || undefined,
        modelUsed: consolidated.modelUsed || lastModel,
        tokens: consolidated.tokens || lastTokens
      };
      this.showResults(result, view.editor, view);
    } catch (e: any) {
      console.error(e);
      new Notice(`Error: ${e.message}`);
    } finally {
      loadingNotice?.hide();
    }
  }
}