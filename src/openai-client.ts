import OpenAI from 'openai';
import { VisionInsightsSettings, VisionAction, NoteContext } from './types';

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

  async analyzeImage(imageData: string, action: VisionAction, noteContext?: NoteContext): Promise<string> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.getPromptForAction(action, noteContext);
    
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

  private getPromptForAction(action: VisionAction, noteContext?: NoteContext): string {
    // Build context section if available
    let contextSection = '';
    if (noteContext) {
      contextSection = `\n\n**NOTE CONTEXT:**\n`;
      contextSection += `This image is embedded in a note titled "${noteContext.noteName}".\n`;
      
      if (noteContext.textBefore.trim()) {
        contextSection += `\n**Text BEFORE this image:**\n${noteContext.textBefore}\n`;
      }
      
      if (noteContext.textAfter.trim()) {
        contextSection += `\n**Text AFTER this image:**\n${noteContext.textAfter}\n`;
      }
      
      contextSection += `\nPlease consider this context when analyzing the image to provide more relevant and contextualized insights.\n`;
    }

    // Common Obsidian formatting instruction
    const obsidianFormatting = `\n\n**FORMATTING:** This output is for an Obsidian note. Format any person names, technologies, systems, tools, companies, or notable concepts with wiki brackets, e.g. [[John Doe]], [[Microsoft Teams]], [[D365]], [[React]], etc. This enables proper linking within the knowledge base.`;

    const prompts: Record<VisionAction, string> = {
      'smart-summary': [
        'Analyze this image and provide a focused 2-3 sentence summary that captures the core message and key takeaways.',
        'Prioritize actionable information, important data, and context that would be valuable for future reference in research notes.',
        'If there are specific metrics, findings, or conclusions shown, highlight them.',
        noteContext ? 'Consider how this image relates to and builds upon the surrounding note content.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'extract-facts': [
        'Extract specific, verifiable facts and data points from this image.',
        'Format as a bulleted list, grouping related facts together where appropriate.',
        'Do not assume the presence of particular types of information—capture only what is clearly shown or stated.',
        'Add brief context to each fact if it aids clarity.',
        noteContext ? 'Pay attention to how these facts relate to the surrounding note context and any ongoing narrative or discussion.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'generate-description': [
        'Create a comprehensive visual description of this image for accessibility and archival purposes.',
        'Structure your response to include:',
        '1) Overall composition and layout,',
        '2) Primary visual elements and their relationships,',
        '3) Text content and its hierarchy,',
        '4) Colors, visual style, and formatting,',
        '5) Context clues and implied meaning.',
        'Write as if describing to someone who cannot see the image.',
        noteContext ? 'Consider how this visual content fits within the broader note context and purpose.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'identify-text': [
        'Perform OCR extraction of ALL visible text in this image.',
        'Maintain the original formatting, hierarchy, and structure.',
        'Organize the output to reflect:',
        '1) Headers and titles (with hierarchy levels),',
        '2) Body text (paragraphs and sentences),',
        '3) Labels and captions,',
        '4) Data in tables or lists,',
        '5) Any annotations or metadata.',
        'Use markdown formatting to preserve structure and indicate text styling where relevant.',
        noteContext ? 'Consider how this extracted text connects to and continues the surrounding note content.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'analyze-structure': [
        'Examine the organizational structure, information architecture, or workflow depicted in this image.',
        'Identify:',
        '1) Main components and their functions,',
        '2) Hierarchical relationships and dependencies,',
        '3) Information flow or process sequence,',
        '4) Groupings and categorizations,',
        '5) Key connections and interfaces.',
        'Explain how the structure serves its purpose and note any patterns or design principles evident.',
        noteContext ? 'Relate this structural analysis to the broader context and themes present in the surrounding note content.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'quick-insights': [
        'Provide 4-6 actionable insights that go beyond surface-level observations.',
        'Look for:',
        '1) Patterns or trends that might not be immediately obvious,',
        '2) Implications or consequences of what\'s shown,',
        '3) Connections to broader concepts or contexts,',
        '4) Potential applications or use cases,',
        '5) Notable details that add significant value.',
        'Focus on insights that would be useful for someone building knowledge or making decisions.',
        noteContext ? 'Draw connections between the image content and the surrounding note context to provide more targeted insights.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'analyze-data-viz': [
        'Analyze this data visualization, chart, graph, or diagram in detail.',
        'Provide:',
        '1) Data interpretation - what the numbers/trends show and their significance,',
        '2) Methodology - how the data is presented and any limitations,',
        '3) Key findings - the most important takeaways and conclusions,',
        '4) Context - what this data suggests about the broader topic,',
        '5) Actionable implications - how this information could be used or what decisions it supports.',
        'Focus on making the data meaningful and accessible.',
        noteContext ? 'Connect this data analysis to the broader narrative and context established in the surrounding note content.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'extract-meeting-participants': [
        'Extract and list all meeting participants visible in this screenshot.',
        'Look for:',
        '1) Participant names (from name tags, labels, or video tiles),',
        '2) Participant avatars or profile pictures,',
        '3) Status indicators (muted, camera on/off, hand raised, etc.),',
        '4) Roles or titles if visible,',
        '5) Host/presenter indicators.',
        'Format as a clean bulleted list with names - surround any firstName lastName combinations with wiki brackets, e.g. [[John Doe]] - and any relevant status information.',
        'If no participants are clearly identifiable, indicate what meeting interface elements are visible instead.',
        noteContext ? 'Consider the meeting context from the surrounding note content, such as meeting agenda or previous discussion topics.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

      'analyze-meeting-content': [
        'Analyze this meeting screenshot comprehensively, focusing on both the shared content and meeting context.',
        'Provide:',
        '1) **Shared Content Analysis** - describe any presentations, documents, or screen shares visible, including key points, slide titles, charts, or data,',
        '2) **Meeting Context** - identify the meeting platform (Zoom, Teams, etc.), meeting layout, and participant information,',
        '3) **Key Information** - extract important text, data, or decisions from the shared content,',
        '4) **Meeting Dynamics** - note any visible interactions like chat messages, raised hands, or presenter mode,',
        '5) **Action Items** - identify any explicit tasks, decisions, or next steps mentioned in the content.',
        'Structure the response to be useful for meeting notes and follow-up.',
        noteContext ? 'Reference the surrounding note context to understand where this meeting fits in the broader discussion or project timeline.' : ''
      ].filter(Boolean).join(' ') + contextSection + obsidianFormatting
    }

    return prompts[action]
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