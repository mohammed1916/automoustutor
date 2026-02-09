import { GoogleGenAI } from "@google/genai";
import { LearnerState, ParsedAgentResponse, CurriculumWeek } from '../types';

// Initialize lazily to avoid module-level errors if env vars aren't ready
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    // Fallback to empty string if undefined to prevent constructor throw, though it will fail on call if invalid
    const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || ''; 
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

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

const generateSystemPrompt = (curriculum: CurriculumWeek[]) => {
  // Serialize curriculum for the prompt
  const curriculumMap = curriculum.map(c => 
    `${c.id.toUpperCase()} – ${c.title}\n${c.topics.map(t => `• ${t}`).join('\n')}`
  ).join('\n\n');

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
• Planner – selects next concept based on learner state, not week number
• Teacher – explains using intuition, formalism, and visual reasoning
• Assessor – generates diagnostic, prediction-based questions
• Diagnostician – classifies misconceptions
• Verifier – checks mathematical and logical consistency
• Memory Manager – proposes structured learner state updates

You are NOT required to follow weeks linearly.
Weeks define scope, not order.

========================
MANDATORY OUTPUT FORMAT
========================

You MUST respond with these 6 sections in this EXACT order. Use the headers exactly as written.

1. DECISION_RATIONALE
(Explain why you are taking this action based on the learner's state)

2. ACTION
(One word only: TEACH | ASSESS | RETEACH | REVIEW | ADVANCE)

3. CONTENT
(The actual message to the learner. Use clear, engaging Markdown. 
IMPORTANT: Use LaTeX for ALL mathematical expressions ($...$ for inline, $$...$$ for block).
IMPORTANT: Use VISUALIZATIONS whenever possible:

A) MERMAID DIAGRAMS (for graphs, flows, trees):
   Wrap in a code block with language "mermaid".
   Example:
   \`\`\`mermaid
   graph TD;
     A-->B;
   \`\`\`

B) FUNCTION PLOTS (for 2D Calculus/Algebra graphs):
   Wrap a valid JSON object in a code block with language "plot".
   The JSON must follow 'function-plot' options.
   Example:
   \`\`\`plot
   {
     "xAxis": {"domain": [-5, 5]},
     "yAxis": {"domain": [-5, 5]},
     "grid": true,
     "data": [
       {"fn": "x^2", "color": "red"}
     ]
   }
   \`\`\`
)

4. VERIFICATION
(Double check your own math and logic here)

5. MEMORY_UPDATE
(A valid JSON object representing the NEW learner state. Do not use Markdown code blocks for this section, just raw JSON.
The JSON must match this interface:
{
  "currentWeek": "string (e.g., Week 1)",
  "focusTopic": "string",
  "masteryLevels": { "Week 1": number (0-100), ... "Week 11": number },
  "misconceptions": ["string"],
  "lastAction": "string",
  "historySummary": "brief summary of interaction"
})

6. NEXT_INTENT
(What you plan to do in the next turn)

========================
ADAPTATION CONSTRAINTS
========================

• Never assume mastery
• Never advance without assessment
• Revisit earlier weeks if prerequisites fail
• Prefer prediction, visualization, and reasoning
• Algorithmic topics must include step-by-step simulation

========================
INITIAL DIRECTIVE
========================

If the learner history is empty, begin by ASSESSING foundational understanding relevant to:
• Week 1 (relations vs functions)
• Week 2 (graph interpretation)
• Week 10 (algorithmic intuition)

Assume no prior mastery.
`;
};

export const sendMessageToAgent = async (
  userMessage: string, 
  currentState: LearnerState,
  chatHistory: Array<{role: 'user' | 'model', parts: {text?: string, inlineData?: any}[]}> = [],
  attachmentBase64?: string,
  curriculum?: CurriculumWeek[]
): Promise<ParsedAgentResponse> => {
  
  if (!process.env.API_KEY) {
     console.warn("API Key missing in process.env");
  }

  try {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview'; 

    const stateContext = `
[SYSTEM: CURRENT LEARNER STATE]
${JSON.stringify(currentState, null, 2)}
    `;

    const finalPrompt = userMessage 
      ? `${userMessage}\n\n${stateContext}`
      : `[SYSTEM: START_SESSION]\n${stateContext}`; 

    const currentUserParts: any[] = [{ text: finalPrompt }];

    // Handle generic attachment (Image, Audio, PDF)
    if (attachmentBase64) {
      const mimeMatch = attachmentBase64.match(/^data:(.*?);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const cleanBase64 = attachmentBase64.split(',')[1] || attachmentBase64;
      
      currentUserParts.unshift({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }
    
    const dynamicSystemPrompt = curriculum ? generateSystemPrompt(curriculum) : generateSystemPrompt([]); 

    const result = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: dynamicSystemPrompt,
        temperature: 0.2,
      },
      contents: [
        ...chatHistory,
        { role: 'user', parts: currentUserParts }
      ]
    });

    const responseText = result.text || '';
    return parseAgentResponse(responseText);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};