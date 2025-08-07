import { NoteContext, VisionAction, VisionInsightsSettings } from './types';

function getObsidianFormatting(settings: VisionInsightsSettings): string {
  const language = settings.outputLanguage && settings.outputLanguage !== 'auto'
    ? `\n- Write in ${settings.outputLanguage} language.`
    : '';
  return `\n\n**FORMATTING (Obsidian Markdown):**\n- Use pure Markdown (no HTML).\n- Prefer short sections with headings, lists, and tables when useful.\n- Keep content concise and skimmable; avoid meta commentary.\n- Use [[Wiki Links]] for people, organizations, products, frameworks, and notable concepts (e.g., [[John Doe]], [[Microsoft Teams]], [[React]]).\n- For code or commands, use fenced code blocks.\n- Do not include system messages, apologies, or disclaimers.${language}`;
}

function buildContext(noteContext?: NoteContext): string {
  if (!noteContext) return '';
  let section = `\n\n**NOTE CONTEXT:**\nThis image is embedded in a note titled "${noteContext.noteName}".`;
  if (noteContext.textBefore?.trim()) section += `\n\n**Text BEFORE this image:**\n${noteContext.textBefore}`;
  if (noteContext.textAfter?.trim()) section += `\n\n**Text AFTER this image:**\n${noteContext.textAfter}`;
  if (noteContext.relatedLinks && noteContext.relatedLinks.length) {
    const links = noteContext.relatedLinks.slice(0, 5).map(l => `- [[${l.title}]] — ${l.excerpt}`).join('\n');
    section += `\n\n**Related Links (nearby):**\n${links}`;
  }
  if (noteContext.sectionTitle) {
    section += `\n\n**Section:** ${noteContext.sectionPath?.join(' > ') || noteContext.sectionTitle}`;
  }
  if (noteContext.sectionText) {
    section += `\n\n**Section Text:**\n${noteContext.sectionText}`;
  }
  if (noteContext.tags && noteContext.tags.length) {
    section += `\n\n**Tags:** ${noteContext.tags.map(t => `#${t}`).join(' ')}`;
  }
  section += `\n\nPlease consider this context when analyzing the image.`;
  return section;
}

export function buildPrompt(
  action: VisionAction,
  settings: VisionInsightsSettings,
  noteContext?: NoteContext,
  customPrompt?: string
): string {
  const contextSection = buildContext(noteContext);
  const obsidianFormatting = getObsidianFormatting(settings);

  const prompts: Record<VisionAction, string> = {
    'smart-summary': [
      'Analyze this image and produce a focused summary for research notes.',
      'Output structure:\n## Key Takeaways (2–4 bullets)\n- Start each bullet with a bold keyword\n## One-liner\n- A single sentence capturing the essence.',
      'Highlight specific metrics, findings, or conclusions if visible.',
      noteContext ? 'Incorporate relevance to the surrounding note context where appropriate.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'extract-facts': [
      'Extract specific, verifiable facts and data points explicitly shown or stated in the image.',
      'Output structure:\n## Facts\n- Group related facts; one fact per bullet\n- Include units and exact wording when relevant\n## Notes (optional)\n- Clarify ambiguities without speculation.',
      noteContext ? 'Relate facts to the surrounding note context when it improves clarity.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'generate-description': [
      'Create an accessibility-grade visual description for archival and screen reader use.',
      'Output structure:\n## Overview\n- Composition and purpose\n## Elements\n- Key objects and relationships\n## Text Content\n- Headings and body text summary\n## Visual Style\n- Colors, style, and formatting\n## Context\n- Implied meaning or intent.',
      noteContext ? 'Situate the description within the surrounding note context if relevant.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'identify-text': [
      'Perform OCR extraction of ALL visible text, preserving structure and hierarchy.',
      'If any text is illegible, mark it as [illegible] and do not paraphrase.',
      'Output structure:\n## Headers\n- H1/H2/H3 as markdown headings\n## Body\n- Paragraphs as plain text\n## Labels & Captions\n- Short lines\n## Tables & Lists\n- Use markdown tables or lists\n## Annotations/Metadata\n- Any extra markings.',
      'Use markdown to represent emphasis and headings. Avoid paraphrasing; prefer verbatim where legible.',
      noteContext ? 'Connect extracted text to the surrounding note context if it clarifies meaning.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'analyze-structure': [
      'Analyze the organizational structure, IA, or workflow shown in the image.',
      'Output structure:\n## Components\n- Main parts and roles\n## Relationships\n- Hierarchy, dependencies\n## Flow\n- Steps and sequence\n## Groupings\n- Clusters and categorization\n## Interfaces\n- Key connections and handoffs\n## Assessment\n- How the structure serves its purpose; patterns or principles.',
      noteContext ? 'Relate structure to themes in the surrounding note content where helpful.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'quick-insights': [
      'Provide 4–6 actionable insights beyond surface-level observations.',
      'Prioritize: non-obvious patterns, implications, connections to broader concepts, applications/use cases, and notable details.',
      'Output bullets starting with bold leads and a short explanation.',
      noteContext ? 'Tie insights to the surrounding note context when it sharpens relevance.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'analyze-data-viz': [
      'Analyze the chart/graph/visualization in detail.',
      'Output structure:\n## Interpretation\n- What the data shows and significance\n## Methodology\n- Encoding, scales, and limitations\n## Key Findings\n- The most important takeaways\n## Context\n- What this suggests about the broader topic\n## Implications\n- Decisions or actions this supports.',
      noteContext ? 'Connect interpretation to the surrounding note narrative where useful.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'extract-meeting-participants': [
      'Extract and list all identifiable meeting participants from the screenshot.',
      'Include: name (use [[First Last]]), optionally role/title and status (muted/camera/chat/host).',
      'If none are identifiable, list visible meeting interface elements instead.',
      'Output as a clean bullet list.',
      noteContext ? 'Use surrounding note context if it helps disambiguate names or roles.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'analyze-meeting-content': [
      'Analyze the meeting screenshot for both shared content and context.',
      'Output structure:\n## Shared Content\n- Presentations/documents and key points\n## Context\n- Platform, layout, participant info\n## Key Information\n- Important text/data/decisions\n## Dynamics\n- Chat, reactions, presenter mode\n## Action Items\n- Explicit tasks, decisions, next steps.',
      noteContext ? 'Use surrounding note context to situate the meeting in a project timeline if visible.' : ''
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting,

    'custom-vision': [
      'You are assisting with research note-taking in Obsidian. Follow the USER INSTRUCTIONS precisely and keep the output practical and skimmable.',
      customPrompt ? `\n\n**USER INSTRUCTIONS:**\n${customPrompt}` : 'No custom instructions provided.',
      noteContext ? 'Use the surrounding note context to tune relevance.' : '',
      '\n\nIf the user instruction could be interpreted in multiple ways, choose the interpretation that produces the most actionable, neatly structured notes.'
    ].filter(Boolean).join(' ') + contextSection + obsidianFormatting
  };

  return prompts[action];
}

export function buildConsolidationPrompt(
  settings: VisionInsightsSettings,
  overallAction: VisionAction,
  analyses: Array<{ filename: string; content: string }>,
  noteContext?: NoteContext,
  customPrompt?: string
): string {
  const contextSection = buildContext(noteContext);
  const obsidianFormatting = getObsidianFormatting(settings);

  const header = `You are consolidating analyses from a sequence of related screenshots (same meeting/topic). Merge them into a single, coherent result.`;

  const intent = customPrompt
    ? `\n\nUSER INSTRUCTIONS (priority):\n${customPrompt}`
    : overallAction === 'extract-facts'
      ? `\n\nGOAL: Produce a single consolidated set of key facts and data points. Deduplicate, reconcile conflicts, and keep only verifiable information.`
      : `\n\nGOAL: Produce a single consolidated output optimized for research notes. Deduplicate, reconcile conflicts, and emphasize the most important cross-image insights.`;

  const guidance = `\n\nGUIDELINES:\n- Do not repeat per-image headings; merge into a unified structure.\n- Prefer concise bullets and short sections.\n- Preserve units, exact wording where relevant.\n- If contradictions exist, call them out and choose the most plausible interpretation.\n- If there are obvious groups/themes across images, organize by theme.\n- Keep only what is actionable and high-signal.`;

  const inputs = `\n\nSOURCE ANALYSES (for consolidation):\n${analyses.map(a => `### ${a.filename}\n\n${a.content}`).join('\n\n---\n\n')}`;

  return [header, intent, contextSection, guidance, inputs, obsidianFormatting].join(' ');
}


