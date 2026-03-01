import { CurriculumWeek } from '../types';

export interface RoutingDecision {
  action: 'NAVIGATE' | 'ADD_MODULE' | 'STAY';
  targetWeekId?: string;
  newModule?: CurriculumWeek;
  reasoning: string;
}

export const analyzeCurriculumIntent = async (
  userMessage: string,
  currentCurriculum: CurriculumWeek[],
  attachmentBase64?: string,
  modelId?: string
): Promise<RoutingDecision> => {
  const response = await fetch('/api/agent/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage,
      currentCurriculum,
      attachmentBase64,
      modelId
    })
  });

  if (!response.ok) {
    return { action: 'STAY', reasoning: `Routing request failed (${response.status})` };
  }

  return response.json();
};
