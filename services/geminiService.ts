import { CurriculumWeek, LearnerState, ParsedAgentResponse } from '../types';

export const sendMessageToAgent = async (
  userMessage: string,
  currentState: LearnerState,
  chatHistory: Array<{ role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }> = [],
  attachmentBase64?: string,
  curriculum?: CurriculumWeek[],
  modelId?: string
): Promise<ParsedAgentResponse> => {
  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage,
      currentState,
      chatHistory,
      attachmentBase64,
      curriculum,
      modelId
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent request failed (${response.status}): ${errorText}`);
  }

  return response.json();
};
