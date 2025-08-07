import { App, Modal, Setting, FuzzySuggestModal } from 'obsidian';
import type { VisionAction } from './types';

export class PromptModal extends Modal {
  private titleText: string;
  private onSubmit: (value: string | null) => void;
  private value: string = '';

  constructor(app: App, titleText: string, onSubmit: (value: string | null) => void) {
    super(app);
    this.titleText = titleText;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: this.titleText });
    const desc = contentEl.createEl('p', {
      text: 'Output will be formatted as Obsidian Markdown automatically.'
    });
    desc.style.marginBottom = '8px';

    new Setting(contentEl)
      .setName('Custom prompt')
      .setDesc('Describe what you want extracted, analyzed, or generated based on the selected image')
      .addTextArea(text => {
        text.setPlaceholder('e.g., Compare trends, list risks, draft action items, generate tags...');
        text.inputEl.style.width = '100%';
        text.inputEl.style.height = '120px';
        text.onChange((value) => this.value = value);
      });

    const buttons = contentEl.createDiv({ cls: 'modal-button-row' });
    const submitBtn = buttons.createEl('button', { text: 'Run' });
    submitBtn.addEventListener('click', () => {
      this.close();
      this.onSubmit(this.value.trim() ? this.value.trim() : null);
    });
    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.close();
      this.onSubmit(null);
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ActionSelectModal extends FuzzySuggestModal<{ action: VisionAction; title: string }> {
  private items: { action: VisionAction; title: string }[];
  private onChoose: (action: VisionAction | null) => void;
  private chosen = false;

  constructor(app: App, items: { action: VisionAction; title: string }[], onChoose: (action: VisionAction | null) => void) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder('Choose a vision action…');
  }

  getItems(): { action: VisionAction; title: string }[] {
    return this.items;
  }

  getItemText(item: { action: VisionAction; title: string }): string {
    return item.title;
  }

  onChooseItem(item: { action: VisionAction; title: string }): void {
    this.chosen = true;
    this.onChoose(item.action);
  }

  onClose(): void {
    if (!this.chosen) {
      this.onChoose(null);
    }
  }
}
