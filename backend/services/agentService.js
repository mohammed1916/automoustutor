import { generateWithProvider } from '../providers/providerFactory.js';

const parseAgentResponse = (text) => {
  const sections = {};
  const patterns = {
    rationale: /1\.\s*DECISION_RATIONALE\s*\n([\s\S]*?)(?=\n2\.\s*ACTION)/i,
    action: /2\.\s*ACTION\s*\n([\s\S]*?)(?=\n3\.\s*CONTENT)/i,
    content: /3\.\s*CONTENT\s*\n([\s\S]*?)(?=\n4\.\s*VERIFICATION)/i,
    verification: /4\.\s*VERIFICATION\s*\n([\s\S]*?)(?=\n5\.\s*MEMORY_UPDATE)/i,
    memoryUpdate: /5\.\s*MEMORY_UPDATE\s*\n([\s\S]*?)(?=\n6\.\s*NEXT_INTENT)/i,
    nextIntent: /6\.\s*NEXT_INTENT\s*\n([\s\S]*?)(?=$)/i
  };

  sections.rationale = text.match(patterns.rationale)?.[1]?.trim() || '';
  sections.action = text.match(patterns.action)?.[1]?.trim() || 'UNKNOWN';
  sections.content = text.match(patterns.content)?.[1]?.trim() || text;
  sections.verification = text.match(patterns.verification)?.[1]?.trim() || '';
  sections.nextIntent = text.match(patterns.nextIntent)?.[1]?.trim() || '';

  const memoryString = text.match(patterns.memoryUpdate)?.[1]?.trim();
  if (memoryString) {
    try {
      const cleanJson = memoryString.replace(/```json/g, '').replace(/```/g, '').trim();
      sections.memoryUpdate = JSON.parse(cleanJson);
    } catch {
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
    raw: text
  };
};

const generateSystemPrompt = (curriculum = []) => {
  const curriculumMap = curriculum
    .map((c) => `${c.id.toUpperCase()} - ${c.title}\n${c.topics.map((t) => `- ${t}`).join('\n')}`)
    .join('\n\n');

  return `
You are an AUTONOMOUS ADAPTIVE LEARNING AGENT for an undergraduate mathematics curriculum.
You operate inside an external control loop that persists learner state, executes your decisions, and feeds updated memory back to you.

========================
DYNAMIC CURRICULUM MAP
========================
${curriculumMap}

========================
AUTONOMOUS OPERATING RULES
========================
You must operate through these internal roles:
- Planner
- Teacher
- Assessor
- Diagnostician
- Verifier
- Memory Manager

========================
MANDATORY OUTPUT FORMAT
========================
You MUST respond with these 6 sections in this EXACT order:
1. DECISION_RATIONALE
2. ACTION
3. CONTENT
4. VERIFICATION
5. MEMORY_UPDATE
6. NEXT_INTENT

ACTION must be one word: TEACH | ASSESS | RETEACH | REVIEW | ADVANCE.

In CONTENT:
- Use Markdown.
- Use LaTeX for math.
- Use Mermaid and plot blocks when useful.

In MEMORY_UPDATE:
- Return only valid JSON matching the learner state schema.
`;
};

export const generateAgentReply = async ({
  userMessage,
  currentState,
  chatHistory = [],
  attachmentBase64,
  curriculum = [],
  modelConfig
}) => {
  const stateContext = `[SYSTEM: CURRENT LEARNER STATE]\n${JSON.stringify(currentState, null, 2)}`;
  const finalPrompt = userMessage ? `${userMessage}\n\n${stateContext}` : `[SYSTEM: START_SESSION]\n${stateContext}`;

  const currentUserParts = [{ text: finalPrompt }];
  if (attachmentBase64) {
    const mimeMatch = attachmentBase64.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const cleanBase64 = attachmentBase64.split(',')[1] || attachmentBase64;
    currentUserParts.unshift({ inlineData: { mimeType, data: cleanBase64 } });
  }

  const { text } = await generateWithProvider({
    modelConfig,
    systemInstruction: generateSystemPrompt(curriculum),
    temperature: 0.2,
    contents: [...chatHistory, { role: 'user', parts: currentUserParts }]
  });

  return parseAgentResponse(text || '');
};
