import { generateWithProvider } from '../providers/providerFactory.js';

const extractJsonObject = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('No JSON object found in model response');
  }
};

export const analyzeCurriculumIntent = async ({
  userMessage,
  currentCurriculum,
  attachmentBase64,
  modelConfig
}) => {
  const curriculumContext = JSON.stringify(
    currentCurriculum.map((c) => ({ id: c.id, title: c.title, topics: c.topics })),
    null,
    2
  );

  const systemPrompt = `
You are the CURRICULUM NAVIGATOR for a math learning app.
Decide one action:
1. NAVIGATE
2. ADD_MODULE
3. STAY

CURRENT CURRICULUM MAP:
${curriculumContext}

Return ONLY JSON in this schema:
{
  "action": "NAVIGATE" | "ADD_MODULE" | "STAY",
  "targetWeekId": "string (existing ID)",
  "newModule": {
    "id": "string",
    "title": "string",
    "description": "string",
    "topics": ["string"]
  },
  "reasoning": "brief explanation"
}
`;

  const parts = [{ text: userMessage || 'Analyze context.' }];
  if (attachmentBase64) {
    const mimeMatch = attachmentBase64.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const cleanBase64 = attachmentBase64.split(',')[1] || attachmentBase64;
    parts.unshift({ inlineData: { mimeType, data: cleanBase64 } });
  }

  const { text } = await generateWithProvider({
    modelConfig,
    systemInstruction: systemPrompt,
    temperature: 0.1,
    responseMimeType: 'application/json',
    contents: [{ role: 'user', parts }]
  });

  return extractJsonObject(text || '{}');
};
