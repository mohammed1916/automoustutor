import { GoogleGenAI } from "@google/genai";
import { LearnerState, ParsedAgentResponse } from '../types';
import { SYSTEM_PROMPT } from '../constants';

// We assume the API key is available in the environment variables
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to parse the strict output format
const parseAgentResponse = (text: string): ParsedAgentResponse => {
  const sections: Partial<ParsedAgentResponse> = {};
  
  // Regex to extract content between headers
  const patterns = {
    rationale: /1\.\s*DECISION_RATIONALE\s*\n([\s\S]*?)(?=\n2\.\s*ACTION)/i,
    action: /2\.\s*ACTION\s*\n([\s\S]*?)(?=\n3\.\s*CONTENT)/i,
    content: /3\.\s*CONTENT\s*\n([\s\S]*?)(?=\n4\.\s*VERIFICATION)/i,
    verification: /4\.\s*VERIFICATION\s*\n([\s\S]*?)(?=\n5\.\s*MEMORY_UPDATE)/i,
    memoryUpdate: /5\.\s*MEMORY_UPDATE\s*\n([\s\S]*?)(?=\n6\.\s*NEXT_INTENT)/i,
    nextIntent: /6\.\s*NEXT_INTENT\s*\n([\s\S]*?)(?=$)/i,
  };

  sections.rationale = text.match(patterns.rationale)?.[1]?.trim() || '';
  sections.action = text.match(patterns.action)?.[1]?.trim() || 'UNKNOWN';
  sections.content = text.match(patterns.content)?.[1]?.trim() || text; // Fallback to full text if parse fails
  sections.verification = text.match(patterns.verification)?.[1]?.trim() || '';
  sections.nextIntent = text.match(patterns.nextIntent)?.[1]?.trim() || '';

  const memoryString = text.match(patterns.memoryUpdate)?.[1]?.trim();
  
  if (memoryString) {
    try {
      // Cleanup markdown if the model added it despite instructions
      const cleanJson = memoryString.replace(/```json/g, '').replace(/```/g, '').trim();
      sections.memoryUpdate = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse memory update JSON", e);
      sections.memoryUpdate = null;
    }
  } else {
    sections.memoryUpdate = null;
  }

  return {
    rationale: sections.rationale || '',
    action: sections.action || 'UNKNOWN',
    content: sections.content || '',
    verification: sections.verification || '',
    memoryUpdate: sections.memoryUpdate || null,
    nextIntent: sections.nextIntent || '',
    raw: text,
  };
};

export const sendMessageToAgent = async (
  userMessage: string, 
  currentState: LearnerState,
  chatHistory: Array<{role: 'user' | 'model', parts: [{text: string}]}> = []
): Promise<ParsedAgentResponse> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  try {
    const model = 'gemini-3-flash-preview'; // Optimal for reasoning tasks

    // Construct the full context including the hidden state
    const stateContext = `
[SYSTEM: CURRENT LEARNER STATE]
${JSON.stringify(currentState, null, 2)}
    `;

    // We don't use ChatSession because we need to inject the rigid state at the end of every turn manually to ensure the "Control Loop" works as designed.
    // Instead, we construct the history for generateContent.
    
    // Convert previous chat history to the format expected by generateContent
    // Note: The prompt is massive, so we rely on the model's large context window.
    
    // We prepend the system prompt to the user's first message or use systemInstruction config
    
    const finalPrompt = userMessage 
      ? `${userMessage}\n\n${stateContext}`
      : `[SYSTEM: START_SESSION]\n${stateContext}`; // Initial trigger

    const result = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2, // Low temperature for consistent formatting
      },
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: finalPrompt }] }
      ]
    });

    const responseText = result.text || '';
    return parseAgentResponse(responseText);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
