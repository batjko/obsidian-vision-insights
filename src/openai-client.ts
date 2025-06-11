import OpenAI from 'openai';
import { VisionInsightsSettings, VisionAction } from './types';

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

  async analyzeImage(imageData: string, action: VisionAction): Promise<string> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.getPromptForAction(action);
    
    try {
      const response = await this.makeAPICall(imageData, prompt, this.settings.preferredModel);
      return response;
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.code === 'model_not_found') {
        console.warn(`Model ${this.settings.preferredModel} not found, falling back to gpt-4o-mini`);
        return await this.makeAPICall(imageData, prompt, 'gpt-4o-mini');
      }
      throw error;
    }
  }

  private async makeAPICall(imageData: string, prompt: string, model: string): Promise<string> {
    const response = await this.client.chat.completions.create({
        model: model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: imageData,
                detail: 'auto'
              }
            }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.1
      });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Invalid response from OpenAI API');
    }

    return content;
  }

  private getPromptForAction(action: VisionAction): string {
    const prompts: Record<VisionAction, string> = {
      'smart-summary': "Analyze this image and provide a focused 2-3 sentence summary that captures the core message and key takeaways. Prioritize actionable information, important data, and context that would be valuable for future reference in research notes. If there are specific metrics, findings, or conclusions shown, highlight them.",
      
      'extract-facts': "Extract specific, verifiable facts and data points from this image. Format as a bulleted list with clear categories. Include: quantitative data (numbers, percentages, dates), proper nouns (names, places, brands), technical specifications, and actionable items. Organize by importance and add brief context where helpful for clarity.",
      
      'generate-description': "Create a comprehensive visual description of this image for accessibility and archival purposes. Structure your response to include: 1) Overall composition and layout, 2) Primary visual elements and their relationships, 3) Text content and its hierarchy, 4) Colors, visual style, and formatting, 5) Context clues and implied meaning. Write as if describing to someone who cannot see the image.",
      
      'identify-text': "Perform OCR extraction of ALL visible text in this image. Maintain the original formatting, hierarchy, and structure. Organize the output to reflect: 1) Headers and titles (with hierarchy levels), 2) Body text (paragraphs and sentences), 3) Labels and captions, 4) Data in tables or lists, 5) Any annotations or metadata. Use markdown formatting to preserve structure and indicate text styling where relevant.",
      
      'analyze-structure': "Examine the organizational structure, information architecture, or workflow depicted in this image. Identify: 1) Main components and their functions, 2) Hierarchical relationships and dependencies, 3) Information flow or process sequence, 4) Groupings and categorizations, 5) Key connections and interfaces. Explain how the structure serves its purpose and note any patterns or design principles evident.",
      
      'quick-insights': "Provide 4-6 actionable insights that go beyond surface-level observations. Look for: 1) Patterns or trends that might not be immediately obvious, 2) Implications or consequences of what's shown, 3) Connections to broader concepts or contexts, 4) Potential applications or use cases, 5) Notable details that add significant value. Focus on insights that would be useful for someone building knowledge or making decisions.",
      
      'analyze-data-viz': "Analyze this data visualization, chart, graph, or diagram in detail. Provide: 1) Data interpretation - what the numbers/trends show and their significance, 2) Methodology - how the data is presented and any limitations, 3) Key findings - the most important takeaways and conclusions, 4) Context - what this data suggests about the broader topic, 5) Actionable implications - how this information could be used or what decisions it supports. Focus on making the data meaningful and accessible."
    };
    
    return prompts[action];
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