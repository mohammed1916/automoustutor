
export interface LearnerState {
  currentWeek: string;
  focusTopic: string;
  masteryLevels: Record<string, number>;
  misconceptions: string[];
  lastAction: string;
  historySummary: string;
}

export interface ParsedAgentResponse {
  rationale: string;
  action: string;
  content: string;
  verification: string;
  memoryUpdate: Partial<LearnerState> | null;
  nextIntent: string;
  raw: string;
}

export interface Attachment {
  type: 'image' | 'audio' | 'pdf' | 'video';
  mimeType: string;
  data: string; // Base64 string (without data: prefix if stored separately, or full Data URL)
}

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  metadata?: ParsedAgentResponse;
  attachment?: string; // Full Data URL for backward compatibility and simplicity in this refactor
  image?: string; // Legacy support
}

export enum AgentAction {
  TEACH = 'TEACH',
  ASSESS = 'ASSESS',
  RETEACH = 'RETEACH',
  REVIEW = 'REVIEW',
  ADVANCE = 'ADVANCE',
  UNKNOWN = 'UNKNOWN'
}

export interface CurriculumWeek {
  id: string;
  title: string;
  description: string;
  topics: string[];
}
