import { InsertionMode, VisionAction } from './types';

export interface ActionConfigMeta {
  title: string;
  icon: string;
  callout: string;
  defaultInsertionMode: InsertionMode;
}

export const ACTIONS: Record<VisionAction, ActionConfigMeta> = {
  'smart-summary': { title: 'Smart Summary', icon: 'file-text', callout: 'summary', defaultInsertionMode: 'callout' },
  'extract-facts': { title: 'Key Facts', icon: 'list', callout: 'info', defaultInsertionMode: 'cursor' },
  'generate-description': { title: 'Description', icon: 'image', callout: 'note', defaultInsertionMode: 'cursor' },
  'identify-text': { title: 'Text Content', icon: 'type', callout: 'quote', defaultInsertionMode: 'cursor' },
  'analyze-structure': { title: 'Structure Analysis', icon: 'network', callout: 'tip', defaultInsertionMode: 'callout' },
  'quick-insights': { title: 'Quick Insights', icon: 'lightbulb', callout: 'example', defaultInsertionMode: 'cursor' },
  'analyze-data-viz': { title: 'Data Visualization Analysis', icon: 'bar-chart', callout: 'info', defaultInsertionMode: 'callout' },
  'analyze-diagram': { title: 'Diagram Analysis + Mermaid', icon: 'git-branch', callout: 'tip', defaultInsertionMode: 'callout' },
  'extract-meeting-participants': { title: 'Meeting Participants', icon: 'users', callout: 'info', defaultInsertionMode: 'cursor' },
  'analyze-meeting-content': { title: 'Meeting Content Analysis', icon: 'video', callout: 'note', defaultInsertionMode: 'callout' },
  'custom-vision': { title: 'Custom Vision', icon: 'pencil', callout: 'note', defaultInsertionMode: 'cursor' }
};


