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
  preferredModel: 'gpt-4.1-mini',
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
  defaultInsertionMode: 'cursor',
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

  registerContextMenus(): void {
    this.registerEvent(
      this.app.workspace.on(
        'editor-menu',
        this.handleEditorMenu.bind(this)
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
    try {
      await this.enforceRateLimit();

      new Notice(`Analyzing image with ${action.replace(/-/g, ' ')}...`);

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

      new Notice(`Analyzing ${images.length} image(s)${usingCustom ? ' with custom instructions' : ' for key information'}…`);

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

      new Notice('Consolidating results…');
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
    }
  }
}