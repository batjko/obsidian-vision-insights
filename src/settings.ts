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
    console.log("Vision Insights: Displaying settings tab.");

    try {
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
            button.setDisabled(true);
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
              button.setDisabled(false);
            }
          }));

      // Model Selection
      new Setting(containerEl)
        .setName('Preferred Model')
        .setDesc('Choose the OpenAI model for image analysis. GPT-5 mini is recommended for best performance.')
        .addDropdown(dropdown => dropdown
          .addOption('gpt-5-mini', 'GPT-5 Mini (Recommended)')
          .addOption('gpt-5-nano', 'GPT-5 Nano (Fastest)')
          .addOption('gpt-5.2', 'GPT-5.2 (Premium)')
          .setValue(this.plugin.settings.preferredModel)
          .onChange(async (value) => {
            this.plugin.settings.preferredModel = value as any;
            await this.plugin.saveSettings();
          }));

      // Output formatting
      containerEl.createEl('h3', { text: 'Output Formatting' });

      new Setting(containerEl)
        .setName('Output Language')
        .setDesc('Language for generated content. "auto" lets the model decide based on context.')
        .addDropdown(drop => drop
          .addOption('auto', 'Auto')
          .addOption('en', 'English')
          .addOption('de', 'German')
          .addOption('fr', 'French')
          .addOption('es', 'Spanish')
          .setValue(this.plugin.settings.outputLanguage ?? 'auto')
          .onChange(async (value) => {
            this.plugin.settings.outputLanguage = value as any;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Max Output Tokens')
        .setDesc('Upper bound for tokens in a single response (content + reasoning). Larger values may increase cost.')
        .addText(text => text
          .setPlaceholder('1500')
          .setValue(String(this.plugin.settings.maxOutputTokens ?? 1500))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.maxOutputTokens = n;
              await this.plugin.saveSettings();
            }
          }));

      new Setting(containerEl)
        .setName('Include Image Link on Insert')
        .setDesc('Append a source link to the image when inserting results into notes')
        .addToggle(toggle => toggle
          .setValue(!!this.plugin.settings.includeImageLink)
          .onChange(async (value) => {
            this.plugin.settings.includeImageLink = value;
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
        { action: 'quick-insights', title: 'Quick Insights', desc: 'Provide notable observations and insights' },
        { action: 'analyze-data-viz', title: 'Analyze Data Visualization', desc: 'Specialized analysis for charts, graphs, and data visualizations' },
        { action: 'extract-meeting-participants', title: 'Extract Meeting Participants', desc: 'Extract list of participants from meeting screenshots' },
        { action: 'analyze-meeting-content', title: 'Analyze Meeting Content', desc: 'Analyze meeting screens including presentations, shared content, and participant information' },
        { action: 'custom-vision', title: 'Custom Vision Prompt', desc: 'Enter a custom instruction and analyze the selected image; output is forced to Obsidian Markdown' }
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
          .addOption('below-image', 'Insert Below Image')
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
            this.display(); // Refresh to show/hide cache settings
          }));

      if (this.plugin.settings.cacheResults) {
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

        new Setting(containerEl)
          .setName('Max Cache Entries')
          .setDesc('Limit the number of cached results (LRU eviction). 0 disables the limit.')
          .addText(text => text
            .setPlaceholder('200')
            .setValue(String(this.plugin.settings.maxCacheEntries ?? 200))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              if (!isNaN(n) && n >= 0) {
                this.plugin.settings.maxCacheEntries = n;
                await this.plugin.saveSettings();
              }
            }));
      }

      // Image Processing
      containerEl.createEl('h3', { text: 'Image Processing' });

      new Setting(containerEl)
        .setName('Downscale Vault Images')
        .setDesc('Downscale large images before upload to reduce cost and latency')
        .addToggle(toggle => toggle
          .setValue(!!this.plugin.settings.downscaleImages)
          .onChange(async (value) => {
            this.plugin.settings.downscaleImages = value;
            await this.plugin.saveSettings();
            this.display();
          }));

      if (this.plugin.settings.downscaleImages) {
        new Setting(containerEl)
          .setName('Max Image Dimension (px)')
          .setDesc('Largest width/height after downscaling')
          .addSlider(slider => slider
            .setLimits(800, 3000, 50)
            .setValue(this.plugin.settings.maxImageDimension ?? 1600)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.maxImageDimension = value;
              await this.plugin.saveSettings();
            }));
      }

      // Per-Action Overrides
      containerEl.createEl('h3', { text: 'Per-Action Overrides' });
      const perActionContainer = containerEl.createDiv();
      const actions: VisionAction[] = [
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
      ];
      for (const action of actions) {
        const section = perActionContainer.createDiv({ cls: 'vi-action-section' });
        section.createEl('h4', { text: action.replace(/-/g, ' ') });
        const cfg = (this.plugin.settings.perActionConfig ?? (this.plugin.settings.perActionConfig = {}))[action] ?? (this.plugin.settings.perActionConfig![action] = {});

        new Setting(section)
          .setName('Model Override')
          .setDesc('Use a specific model for this action')
          .addDropdown(drop => drop
            .addOption('', 'Default')
            .addOption('gpt-5-mini', 'GPT-5 Mini')
            .addOption('gpt-5-nano', 'GPT-5 Nano')
            .addOption('gpt-5.2', 'GPT-5.2')
            .setValue((cfg.model as any) ?? '')
            .onChange(async (value) => {
              cfg.model = (value || undefined) as any;
              this.plugin.settings.perActionConfig![action] = cfg;
              await this.plugin.saveSettings();
            }));

        new Setting(section)
          .setName('Temperature Override')
          .setDesc('Randomness of output (0–1); lower is more factual')
          .addText(text => text
            .setPlaceholder('Default')
            .setValue(cfg.temperature != null ? String(cfg.temperature) : '')
            .onChange(async (value) => {
              const n = parseFloat(value);
              cfg.temperature = isNaN(n) ? undefined : n;
              this.plugin.settings.perActionConfig![action] = cfg;
              await this.plugin.saveSettings();
            }));

        new Setting(section)
          .setName('Image Detail')
          .setDesc('Level of detail to request from the vision model')
          .addDropdown(drop => drop
            .addOption('', 'Default (auto)')
            .addOption('low', 'Low')
            .addOption('auto', 'Auto')
            .addOption('high', 'High')
            .setValue((cfg.imageDetail as any) ?? '')
            .onChange(async (value) => {
              cfg.imageDetail = (value || undefined) as any;
              this.plugin.settings.perActionConfig![action] = cfg;
              await this.plugin.saveSettings();
            }));

        new Setting(section)
          .setName('Default Insertion Mode')
          .setDesc('Preferred insertion mode for this action')
          .addDropdown(drop => drop
            .addOption('', 'Default')
            .addOption('cursor', 'At Cursor Position')
            .addOption('quote', 'As Blockquote')
            .addOption('callout', 'As Callout')
            .addOption('new-note', 'Create New Note')
            .addOption('daily-note', 'Append to Daily Note')
            .addOption('above-image', 'Insert Above Image')
            .addOption('below-image', 'Insert Below Image')
            .addOption('replace-image-callout', 'Replace Image with Callout')
            .setValue((cfg.defaultInsertionMode as any) ?? '')
            .onChange(async (value) => {
              cfg.defaultInsertionMode = (value || undefined) as any;
              this.plugin.settings.perActionConfig![action] = cfg;
              await this.plugin.saveSettings();
            }));
      }
      // Rate Limiting
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

      // Add some helpful information
      containerEl.createEl('h3', { text: 'Usage Tips' });
      const tipsContainer = containerEl.createDiv('tips-container');
      tipsContainer.createEl('p', { text: '• Right-click on any image in your notes to access Vision Insights' });
      tipsContainer.createEl('p', { text: '• Works with both [[image.png]] and ![](image.png) syntax' });
      tipsContainer.createEl('p', { text: '• Results can be inserted in multiple formats for different use cases' });
      tipsContainer.createEl('p', { text: '• Enable caching to save on API calls for repeated analysis' });
    } catch (error) {
      console.error("Vision Insights: Error displaying settings tab:", error);
      containerEl.createEl('h3', { text: "Error Loading Settings" });
      containerEl.createEl('p', { text: "Could not display the settings for Vision Insights. Please check the developer console for more details."});
    }
  }
} 