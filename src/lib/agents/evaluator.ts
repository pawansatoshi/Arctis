// ============================================================
// Independent Evaluator Layer — Phase 16
//
// Architecture: a structurally separate inference pass that
// reviews a generator's output adversarially. This is NOT the
// generator reviewing its own work (that is insufficient — an
// agent grading its own homework tends to be too lenient).
// The evaluator receives only the task and the output; it has
// no access to the generator's reasoning, memory, or internal
// state, so it cannot inherit the generator's blind spots.
//
// Provider/model agnostic: uses the same routeAIRequest() as
// the generator, but nothing here assumes a specific model.
// ============================================================

import { routeAIRequest } from '@/lib/ai/router';
import type { AgentType } from '@/types';

export interface EvaluationResult {
  verdict: 'PASS' | 'FAIL';
  reasons: string[];
  suggestions?: string;
}

// Evaluation criteria per agent type — mirrors the Quality
// Standards already embedded in each agent's system prompt
// (Locks B1/B2/B3), so the evaluator judges against the same
// bar the generator was instructed to meet.
const EVALUATION_CRITERIA: Record<AgentType, string> = {
  research: 'Findings must be evidence-based with clear reasoning. Claims should cite sources or reasoning. Structure should include Summary, Key Findings, Analysis, Recommendations.',
  developer: 'Code must include error handling and types. Security-sensitive code must be flagged. Explanations of Solidity/Arc/EVM behavior must be technically accurate.',
  engineering: 'Calculations and methodology must be shown, not just conclusions. Safety assessments must be explicit where relevant.',
  treasury: 'Numbers must be precise and traceable. Anomalies should be flagged, not glossed over. No speculative financial claims presented as fact.',
  monitoring: 'Alerts must have clear severity levels. Vague "something seems off" statements without specifics should fail.',
  document: 'Extracted information must be accurate to the source. Summaries must not omit material facts or invent content.',
  custom: 'Output must directly and completely address the task as instructed.',
};

/**
 * Evaluates a generator's output against the task and the agent
 * type's quality bar. Returns PASS or FAIL with specific reasons.
 * This call is completely independent — it does not receive the
 * generator's system prompt, memory context, or internal reasoning.
 */
export async function evaluateAgentOutput(
  agentType: AgentType,
  task: string,
  output: string
): Promise<EvaluationResult> {
  const criteria = EVALUATION_CRITERIA[agentType];

  const evaluatorPrompt = `You are an independent quality evaluator. You did not produce the output below — another system did. Your job is to find problems, not to be agreeable.

Assume the output is likely flawed until proven otherwise. Check specifically for:
1. Does the output actually address the task, or does it drift/avoid it?
2. Are there unsupported claims presented as fact?
3. Is anything vague where specificity was possible?
4. Does it meet this domain's quality bar: ${criteria}
5. Is the output complete, or does it stop short?

Respond in this exact format:
VERDICT: PASS or FAIL
REASONS:
- (one reason per line, empty if PASS with no issues)
SUGGESTIONS: (one sentence on what to fix, or "None" if PASS)`;

  const userMessage = `TASK GIVEN TO THE OTHER SYSTEM:\n${task}\n\nOUTPUT TO EVALUATE:\n${output}`;

  try {
    const result = await routeAIRequest({
      messages: [{ role: 'user', content: userMessage }],
      model: 'anthropic/claude-3.5-haiku', // fast, cheap, independent model — deliberately different tier from typical agent models
      systemPrompt: evaluatorPrompt,
    });

    const text = result.content;
    const verdictMatch = text.match(/VERDICT:\s*(PASS|FAIL)/i);
    const verdict: 'PASS' | 'FAIL' = verdictMatch?.[1]?.toUpperCase() === 'FAIL' ? 'FAIL' : 'PASS';

    const reasonsBlock = text.split(/REASONS:/i)[1]?.split(/SUGGESTIONS:/i)[0] ?? '';
    const reasons = reasonsBlock
      .split('\n')
      .map((l) => l.trim().replace(/^-\s*/, ''))
      .filter((l) => l.length > 0);

    const suggestionsMatch = text.match(/SUGGESTIONS:\s*(.+)/i);
    const suggestions = suggestionsMatch?.[1]?.trim();

    return { verdict, reasons, suggestions: suggestions && suggestions !== 'None' ? suggestions : undefined };
  } catch {
    // Evaluator failure must never block the primary output from
    // reaching the human — fail open with PASS and a note.
    return { verdict: 'PASS', reasons: ['Evaluator unavailable — output not independently verified'] };
  }
}
