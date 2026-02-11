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
        console.warn(`Model ${this.settings.preferredModel} not found, falling back to gpt-5-mini`);
        return await this.makeAPICall(imageData, prompt, action, 'gpt-5-mini');
      }
      throw this.toDetailedError(error, 'image analysis');
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
    const maxTokens = this.settings.maxOutputTokens ?? 1500;
    const detail = perAction.imageDetail || 'auto';

    let response: any;
    try {
      response = await this.client.responses.create({
        model,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageData, detail }
          ]
        }],
        max_output_tokens: maxTokens
      });
    } catch (error) {
      throw this.toDetailedError(error, `image request (${model})`);
    }

    const content = this.extractTextContent(response);
    if (!content) throw this.createMissingContentError(response, model, 'image request');

    return {
      content,
      modelUsed: response.model || model,
      tokens: this.extractTotalTokens(response)
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
    const maxTokens = this.settings.maxOutputTokens ?? 1800;

    let response: any;
    try {
      response = await this.client.responses.create({
        model,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt }
          ]
        }],
        max_output_tokens: maxTokens
      });
    } catch (error) {
      throw this.toDetailedError(error, `consolidation request (${model})`);
    }

    const content = this.extractTextContent(response);
    if (!content) throw this.createMissingContentError(response, model, 'consolidation request');
    return {
      content,
      modelUsed: response.model || model,
      tokens: this.extractTotalTokens(response)
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

  private extractTextContent(response: any): string {
    if (!response || typeof response !== 'object') return '';

    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    if (!Array.isArray(response.output)) return '';

    const text = response.output
      .flatMap((outputItem: any) => Array.isArray(outputItem?.content) ? outputItem.content : [])
      .map((part: any) => {
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    return text;
  }

  private createMissingContentError(response: any, model: string, context: string): Error {
    const status = response?.status ?? 'unknown';
    const incompleteReason = response?.incomplete_details?.reason ?? 'none';
    const refusal = this.extractRefusal(response);
    const responseId = response?.id ?? 'unknown';
    return new Error(
      `OpenAI returned no text content (${context}). model=${model}, status=${status}, incomplete_reason=${incompleteReason}, refusal=${refusal}, response_id=${responseId}`
    );
  }

  private toDetailedError(error: unknown, context: string): Error {
    if (error instanceof OpenAI.APIError) {
      const status = error.status ?? 'unknown';
      const code = error.code ?? 'unknown';
      const type = (error as any).type ?? 'unknown';
      return new Error(`OpenAI API error during ${context}: status=${status}, code=${code}, type=${type}, message=${error.message}`);
    }

    if (error instanceof Error) {
      return new Error(`OpenAI request failed during ${context}: ${error.message}`);
    }

    return new Error(`OpenAI request failed during ${context}: ${this.stringifyUnknown(error)}`);
  }

  private stringifyUnknown(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  private extractRefusal(response: any): string {
    if (!Array.isArray(response?.output)) return 'none';

    for (const outputItem of response.output) {
      if (!Array.isArray(outputItem?.content)) continue;
      for (const part of outputItem.content) {
        if (part?.type !== 'refusal') continue;
        if (typeof part.refusal === 'string' && part.refusal.trim()) return part.refusal.trim();
      }
    }
    return 'none';
  }

  private extractTotalTokens(response: any): number | undefined {
    const totalTokens = response?.usage?.total_tokens;
    if (typeof totalTokens === 'number') return totalTokens;

    const inputTokens = typeof response?.usage?.input_tokens === 'number' ? response.usage.input_tokens : 0;
    const outputTokens = typeof response?.usage?.output_tokens === 'number' ? response.usage.output_tokens : 0;
    const sum = inputTokens + outputTokens;
    return sum > 0 ? sum : undefined;
  }

} 