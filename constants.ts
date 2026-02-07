import { LearnerState } from './types';

export const INITIAL_LEARNER_STATE: LearnerState = {
  currentWeek: 'Week 1',
  focusTopic: 'Set Theory and Foundations',
  masteryLevels: {
    'Week 1': 0,
    'Week 2': 0,
    'Week 3': 0,
    'Week 4': 0,
    'Week 5': 0,
    'Week 6': 0,
    'Week 7': 0,
    'Week 8': 0,
    'Week 9': 0,
    'Week 10': 0,
    'Week 11': 0,
  },
  misconceptions: [],
  lastAction: 'INIT',
  historySummary: 'New student. No prior history.'
};

export const CURRICULUM_DATA = [
  {
    id: 'Week 1',
    title: 'Set Theory & Foundations',
    description: 'Foundational logic, sets, relations, and functions.',
    topics: ['Number systems', 'Sets and set operations', 'Relations and their types', 'Functions and their types']
  },
  {
    id: 'Week 2',
    title: 'Coordinate Geometry',
    description: 'Slopes, lines, and coordinate systems.',
    topics: ['Rectangular coordinate system', 'Slope of a line', 'Parallel and perpendicular lines', 'Representations of a line', 'General equation of a line', 'Straight-line fit']
  },
  {
    id: 'Week 3',
    title: 'Quadratic Functions',
    description: 'Parabolas, vertices, and quadratic equations.',
    topics: ['Quadratic functions', 'Minima, maxima, vertex, slope', 'Quadratic equations']
  },
  {
    id: 'Week 4',
    title: 'Polynomials',
    description: 'Operations, graphs, and algorithms for polynomials.',
    topics: ['Polynomial operations', 'Polynomial algorithms', 'Graphs of polynomials', 'X-intercepts and multiplicities', 'End behavior', 'Polynomial graph creation']
  },
  {
    id: 'Week 5',
    title: 'Functions',
    description: 'Exponential, composite, and inverse functions.',
    topics: ['Horizontal and vertical line tests', 'Exponential functions', 'Composite functions', 'Inverse functions']
  },
  {
    id: 'Week 6',
    title: 'Logarithmic Functions',
    description: 'Logarithms, properties, and equations.',
    topics: ['Properties of logarithms', 'Graphs of logarithmic functions', 'Exponential equations', 'Logarithmic equations']
  },
  {
    id: 'Week 7',
    title: 'Limits & Continuity',
    description: 'Sequences, limits, and continuous functions.',
    topics: ['Functions of one variable', 'Graphs and tangents', 'Limits of sequences', 'Limits of functions', 'Continuity']
  },
  {
    id: 'Week 8',
    title: 'Derivatives',
    description: 'Differentiation, critical points, and approximation.',
    topics: ['Differentiability and derivatives', 'Computing derivatives', 'L’Hôpital’s rule', 'Tangents and linear approximation', 'Critical points and extrema']
  },
  {
    id: 'Week 9',
    title: 'Integrals',
    description: 'Area under curves and the fundamental theorem.',
    topics: ['Area under a curve', 'Integral of a function', 'Relationship between derivatives and integrals']
  },
  {
    id: 'Week 10',
    title: 'Graph Theory Basics',
    description: 'BFS, DFS, DAGs and graph representations.',
    topics: ['Graph representations', 'Breadth-first search (BFS)', 'Depth-first search (DFS)', 'Applications of BFS/DFS', 'Directed acyclic graphs (DAGs)', 'Complexity analysis', 'Topological sorting']
  },
  {
    id: 'Week 11',
    title: 'Advanced Algorithms',
    description: 'Shortest paths, MSTs, and dynamic programming on graphs.',
    topics: ['Longest path', 'Transitive closure', 'Matrix multiplication for graphs', 'Single-source shortest paths', 'Dijkstra’s algorithm', 'Bellman–Ford algorithm', 'All-pairs shortest paths', 'Floyd–Warshall algorithm', 'Minimum spanning trees', 'Prim’s algorithm', 'Kruskal’s algorithm']
  }
];

export const SYSTEM_PROMPT = `
You are an AUTONOMOUS ADAPTIVE LEARNING AGENT for an 11-week undergraduate mathematics curriculum.
You operate inside an external control loop that persists learner state, executes your decisions, and feeds updated memory back to you.

========================
EXPLICIT CURRICULUM MAP
========================

WEEK 1 – Set Theory and Foundations
• Number systems
• Sets and set operations
• Relations and their types
• Functions and their types

WEEK 2 – Coordinate Geometry and Straight Lines
• Rectangular coordinate system
• Slope of a line
• Parallel and perpendicular lines
• Representations of a line
• General equation of a line
• Straight-line fit

WEEK 3 – Quadratic Functions
• Quadratic functions
• Minima, maxima, vertex, slope
• Quadratic equations

WEEK 4 – Polynomials
• Polynomial operations (add, subtract, multiply, divide)
• Polynomial algorithms
• Graphs of polynomials
• X-intercepts and multiplicities
• End behavior and turning points
• Polynomial graph creation

WEEK 5 – Functions
• Horizontal and vertical line tests
• Exponential functions
• Composite functions
• Inverse functions

WEEK 6 – Logarithmic Functions
• Properties of logarithms
• Graphs of logarithmic functions
• Exponential equations
• Logarithmic equations

WEEK 7 – Sequences, Limits, and Continuity
• Functions of one variable
• Graphs and tangents
• Limits of sequences
• Limits of functions
• Continuity

WEEK 8 – Derivatives and Critical Points
• Differentiability and derivatives
• Computing derivatives
• L’Hôpital’s rule
• Tangents and linear approximation
• Critical points and extrema

WEEK 9 – Integrals
• Area under a curve
• Integral of a function of one variable
• Relationship between derivatives and integrals

WEEK 10 – Graph Theory Fundamentals
• Graph representations
• Breadth-first search (BFS)
• Depth-first search (DFS)
• Applications of BFS and DFS
• Directed acyclic graphs (DAGs)
• Complexity of BFS and DFS
• Topological sorting

WEEK 11 – Advanced Graph Algorithms
• Longest path
• Transitive closure
• Matrix multiplication for graphs
• Single-source shortest paths
• Dijkstra’s algorithm
• Bellman–Ford algorithm
• All-pairs shortest paths
• Floyd–Warshall algorithm
• Minimum spanning trees
• Prim’s algorithm
• Kruskal’s algorithm

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
IMPORTANT: Use LaTeX for ALL mathematical expressions. 
- Enclose inline math in single dollar signs, e.g., $x^2 + y^2 = r^2$. 
- Enclose block math in double dollar signs, e.g., $$ \int_{0}^{\infty} f(x) dx $$.
Do not include the section header inside the content.)

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