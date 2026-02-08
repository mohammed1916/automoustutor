import { GoogleGenAI } from "@google/genai";
import { CurriculumWeek } from '../types';

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    const key = process.env.API_KEY || ''; 
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

export interface RoutingDecision {
  action: 'NAVIGATE' | 'ADD_MODULE' | 'STAY';
  targetWeekId?: string; // If navigating
  newModule?: CurriculumWeek; // If adding
  reasoning: string;
}

export const analyzeCurriculumIntent = async (
  userMessage: string, 
  currentCurriculum: CurriculumWeek[],
  attachmentBase64?: string
): Promise<RoutingDecision> => {
  
  if (!process.env.API_KEY) return { action: 'STAY', reasoning: 'No API Key' };

  try {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview'; 

    const curriculumContext = JSON.stringify(currentCurriculum.map(c => ({ id: c.id, title: c.title, topics: c.topics })), null, 2);

    const systemPrompt = `
You are the CURRICULUM NAVIGATOR for a math learning app.
Your goal is to analyze the user's input and decide if the UI should:
1. NAVIGATE to an existing week because the user is asking about a topic covered there.
2. ADD_MODULE (Create new content) because the user is asking about a math/science topic NOT in the current curriculum.
3. STAY (Do nothing) if the user is just chatting, answering a question, or staying on the current topic.

CURRENT CURRICULUM MAP:
${curriculumContext}

RULES:
- If the user's query strongly matches a topic in a specific Week (and it's not the currently active one), choose NAVIGATE.
- If the user asks for a topic strictly OUTSIDE the current map (e.g., "Teach me about Tensors" or "Physics"), choose ADD_MODULE.
- The new module ID should be "Week X" (next number) or "Extra".
- If the input is just "Yes", "No", "Explain more", or an answer to a math problem, usually STAY.
- Return ONLY JSON.

JSON FORMAT:
{
  "action": "NAVIGATE" | "ADD_MODULE" | "STAY",
  "targetWeekId": "string (existing ID)",
  "newModule": { 
     "id": "string", 
     "title": "string", 
     "description": "string", 
     "topics": ["string"] 
  } (ONLY if action is ADD_MODULE),
  "reasoning": "brief explanation"
}
    `;

    const parts: any[] = [{ text: userMessage || "Analyze context." }];
    
    if (attachmentBase64) {
      const mimeMatch = attachmentBase64.match(/^data:(.*?);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const cleanBase64 = attachmentBase64.split(',')[1] || attachmentBase64;
      
      parts.unshift({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }

    const result = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temp for routing
      },
      contents: [{ role: 'user', parts }]
    });

    const responseText = result.text || '{}';
    const decision = JSON.parse(responseText) as RoutingDecision;
    
    return decision;

  } catch (error) {
    console.error("Routing Agent failed:", error);
    return { action: 'STAY', reasoning: 'Error' };
  }
};