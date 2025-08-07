import { App, Modal, Editor, MarkdownView, Setting, Notice, MarkdownRenderer } from 'obsidian';
import { AnalysisResult, InsertionMode } from './types';
import VisionInsightsPlugin from '../main';

export class ResultsModal extends Modal {
  private result: AnalysisResult;
  private editor: Editor;
  private view: MarkdownView;

  constructor(app: App, private plugin: VisionInsightsPlugin) {
    super(app);
  }

  show(result: AnalysisResult, editor: Editor, view: MarkdownView) {
    this.result = result;
    this.editor = editor;
    this.view = view;
    this.open();
  }

  onOpen() {
    const { contentEl } = this;
    // Ensure modal has a specific class for targeted styling
    this.modalEl.addClass('vision-insights-modal');
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

    // Results content with render toggle
    const resultContent = contentEl.createDiv('result-content');
    const toolbar = resultContent.createDiv({ cls: 'result-toolbar' });
    const toggleBtn = toolbar.createEl('button', { text: 'Show raw' });
    const rerunBtn = toolbar.createEl('button', { text: 'Re-run (bypass cache)' });
    const invalidateBtn = toolbar.createEl('button', { text: 'Invalidate cache' });

    const renderContainer = resultContent.createDiv({ cls: 'analysis-result-rendered' });
    MarkdownRenderer.render(
      this.app,
      this.result.content,
      renderContainer,
      this.view.file?.path || '',
      this.plugin
    );

    const rawContainer = resultContent.createEl('pre', { cls: 'analysis-result-raw is-hidden' });
    rawContainer.createEl('code', { text: this.result.content });

    toggleBtn.addEventListener('click', () => {
      const showingRaw = !rawContainer.classList.contains('is-hidden');
      if (showingRaw) {
        rawContainer.classList.add('is-hidden');
        renderContainer.removeClass('is-hidden');
        toggleBtn.setText('Show raw');
      } else {
        renderContainer.addClass('is-hidden');
        rawContainer.classList.remove('is-hidden');
        toggleBtn.setText('Show rendered');
      }
    });

    rerunBtn.addEventListener('click', async () => {
      await this.plugin.executeVisionAction(this.result.action as any, this.result.imageInfo as any, this.editor, this.view, this.result.customPrompt);
      this.close();
    });

    invalidateBtn.addEventListener('click', () => {
      this.plugin.cacheManager.invalidate(this.result.imageInfo, this.result.action as any, this.result.noteContext, this.result.customPrompt);
      new Notice('Cache entry invalidated');
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
        .onClick(() => this.insertResult('new-note')))
      .addButton(btn => btn
        .setButtonText('Insert Above Image')
        .onClick(() => this.insertResult('above-image')))
      .addButton(btn => btn
        .setButtonText('Insert Below Image')
        .onClick(() => this.insertResult('below-image')))
      .addButton(btn => btn
        .setButtonText('Replace Image with Callout')
        .onClick(() => this.insertResult('replace-image-callout')));
  }

  private getActionTitle(action: string): string {
    const titles: Record<string, string> = {
      'smart-summary': 'Smart Summary',
      'extract-facts': 'Key Facts',
      'generate-description': 'Description',
      'identify-text': 'Text Content',
      'analyze-structure': 'Structure Analysis',
      'quick-insights': 'Quick Insights',
      'analyze-data-viz': 'Data Visualization Analysis',
      'extract-meeting-participants': 'Meeting Participants',
      'analyze-meeting-content': 'Meeting Content Analysis',
      'custom-vision': 'Custom Vision'
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

        case 'above-image':
          this.insertRelativeToImage('above');
          break;

        case 'below-image':
          this.insertRelativeToImage('below');
          break;

        case 'replace-image-callout':
          this.replaceImageWithCallout();
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

  private insertRelativeToImage(position: 'above' | 'below') {
    if (!this.result.noteContext?.matchIndex || this.result.noteContext.matchLength == null) {
      this.editor.replaceSelection(this.formatContent(this.result.content, 'cursor'));
      return;
    }
    const content = this.formatContent(this.result.content, 'cursor');
    const doc = this.editor.getValue();
    const insertAt = position === 'above'
      ? this.result.noteContext.matchIndex
      : this.result.noteContext.matchIndex + this.result.noteContext.matchLength;
    const before = doc.slice(0, insertAt) + '\n\n' + content + '\n\n';
    const after = doc.slice(insertAt);
    this.editor.setValue(before + after);
  }

  private replaceImageWithCallout() {
    if (!this.result.noteContext?.matchIndex || this.result.noteContext.matchLength == null) {
      this.editor.replaceSelection(this.formatContent(this.result.content, 'callout'));
      return;
    }
    const calloutType = this.getCalloutType(this.result.action);
    const content = `> [!${calloutType}] ${this.getActionTitle(this.result.action)}\n> ${this.formatContent(this.result.content, 'callout').replace(/\n/g, '\n> ')}`;
    const doc = this.editor.getValue();
    const start = this.result.noteContext.matchIndex;
    const end = start + this.result.noteContext.matchLength;
    const updated = doc.slice(0, start) + content + '\n' + doc.slice(end);
    this.editor.setValue(updated);
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