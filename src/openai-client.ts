import OpenAI from 'openai';
import { VisionInsightsSettings, VisionAction, NoteContext } from './types';
import { buildPrompt, buildConsolidationPrompt } from './prompts';

export class OpenAIClient {
  private client: OpenAI;

  constructor(private settings: VisionInsightsSettings) {
    this.client = new OpenAI({
        apiKey: this.settings.openaiApiKey,
        dangerouslyAllowBrowser: true,
    });
  }

  updateSettings(settings: VisionInsightsSettings) {
    this.settings = settings;
    this.client = new OpenAI({
        apiKey: this.settings.openaiApiKey,
        dangerouslyAllowBrowser: true,
    });
  }

  async analyzeImage(
    imageData: string,
    action: VisionAction,
    noteContext?: NoteContext,
    customPrompt?: string
  ): Promise<{ content: string; modelUsed: string; tokens?: number }> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = buildPrompt(action, this.settings, noteContext, customPrompt);
    
    try {
      const response = await this.makeAPICall(imageData, prompt, action);
      return response;
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.code === 'model_not_found') {
        console.warn(`Model ${this.settings.preferredModel} not found, falling back to gpt-4o-mini`);
        return await this.makeAPICall(imageData, prompt, action, 'gpt-4o-mini');
      }
      throw error;
    }
  }

  private async makeAPICall(
    imageData: string,
    prompt: string,
    action: VisionAction,
    overrideModel?: string
  ): Promise<{ content: string; modelUsed: string; tokens?: number }> {
    const perAction = this.settings.perActionConfig?.[action] || {};
    const model = overrideModel || perAction.model || this.settings.preferredModel;
    const temperature = perAction.temperature ?? 0.1;
    const maxTokens = this.settings.maxOutputTokens ?? 1500;
    const detail = perAction.imageDetail || 'auto';

    const response = await this.client.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageData, detail } }
        ]
      }],
      max_tokens: maxTokens,
      temperature
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Invalid response from OpenAI API');

    return {
      content,
      modelUsed: (response as any).model || model,
      tokens: (response as any).usage?.total_tokens
    };
  }

  async consolidateAnalyses(
    analyses: Array<{ filename: string; content: string }>,
    overallAction: VisionAction,
    noteContext?: NoteContext,
    customPrompt?: string
  ): Promise<{ content: string; modelUsed: string; tokens?: number }> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = buildConsolidationPrompt(this.settings, overallAction, analyses, noteContext, customPrompt);

    const perAction = this.settings.perActionConfig?.[overallAction] || {};
    const model = perAction.model || this.settings.preferredModel;
    const temperature = perAction.temperature ?? 0.2;
    const maxTokens = this.settings.maxOutputTokens ?? 1800;

    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Invalid response from OpenAI API');
    return {
      content,
      modelUsed: (response as any).model || model,
      tokens: (response as any).usage?.total_tokens
    };
  }

  async validateApiKey(): Promise<boolean> {
     if (!this.client) {
        return false;
    }
    try {
        await this.client.models.list();
        return true;
    } catch (error) {
        console.error("API Key validation error:", error);
        return false;
    }
  }
} 