import { Plugin, Menu, Editor, MarkdownView, Notice, TFile, MenuItem, TAbstractFile } from 'obsidian';
import { VisionInsightsSettings, VisionAction, ImageInfo, AnalysisResult } from './src/types';
import { ImageHandler } from './src/image-handler';
import { OpenAIClient } from './src/openai-client';
import { ResultsModal } from './src/results-modal';
import { VisionInsightsSettingTab } from './src/settings';
import { CacheManager } from './src/cache-manager';

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
    'analyze-meeting-content'
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

    const actionConfigs: Array<{
      action: VisionAction;
      title: string;
      icon: string;
    }> = [
      { action: 'smart-summary', title: '📝 Smart Summary', icon: 'file-text' },
      { action: 'extract-facts', title: '📊 Extract Key Facts', icon: 'list' },
      { action: 'generate-description', title: '🖼️ Generate Description', icon: 'image' },
      { action: 'identify-text', title: '🔤 Identify Text (OCR)', icon: 'type' },
      { action: 'analyze-structure', title: '🏗️ Analyze Structure', icon: 'network' },
      { action: 'quick-insights', title: '💡 Quick Insights', icon: 'lightbulb' },
      { action: 'analyze-data-viz', title: '📈 Analyze Data Visualization', icon: 'bar-chart' },
      { action: 'extract-meeting-participants', title: '👥 Extract Meeting Participants', icon: 'users' },
      { action: 'analyze-meeting-content', title: '🎥 Analyze Meeting Content', icon: 'video' }
    ];

    for (const config of actionConfigs) {
      if (this.settings.enabledActions.includes(config.action)) {
        menu.addItem((item: MenuItem) => {
          item
            .setTitle(config.title)
            .setIcon(config.icon)
            .onClick(() =>
              this.executeVisionAction(
                config.action,
                imageInfo,
                editor,
                view
              )
            );
        });
      }
    }

    menu.addSeparator();
  }

  async executeVisionAction(
    action: VisionAction,
    imageInfo: ImageInfo,
    editor: Editor,
    view: MarkdownView
  ): Promise<void> {
    try {
      await this.enforceRateLimit();

      new Notice(`Analyzing image with ${action.replace(/-/g, ' ')}...`);

      // Extract note context around the image
      const noteContext = this.imageHandler.extractNoteContext(editor, view, imageInfo);

      const cachedResult: string | null = this.cacheManager.getCachedResult(imageInfo, action, noteContext);
      if (cachedResult) {
        new Notice('Showing cached result.');
        this.showResults(
          {
            action,
            content: cachedResult,
            imageInfo,
            timestamp: Date.now(),
            cached: true
          },
          editor,
          view
        );
        return;
      }

      const imageData: ArrayBuffer | string = await this.imageHandler.prepareImageForAPI(imageInfo);
      const result: string = await this.openaiClient.analyzeImage(imageData, action, noteContext);

      this.cacheManager.cacheResult(imageInfo, action, result, noteContext);

      this.showResults(
        {
          action,
          content: result,
          imageInfo,
          timestamp: Date.now(),
          cached: false
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
}