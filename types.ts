
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

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  metadata?: ParsedAgentResponse;
  image?: string; // Base64 Data URL
}

export enum AgentAction {
  TEACH = 'TEACH',
  ASSESS = 'ASSESS',
  RETEACH = 'RETEACH',
  REVIEW = 'REVIEW',
  ADVANCE = 'ADVANCE',
  UNKNOWN = 'UNKNOWN'
}
