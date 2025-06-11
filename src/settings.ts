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
        { action: 'quick-insights', title: 'Quick Insights', desc: 'Provide notable observations and insights' },
        { action: 'analyze-data-viz', title: 'Analyze Data Visualization', desc: 'Specialized analysis for charts, graphs, and data visualizations' }
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