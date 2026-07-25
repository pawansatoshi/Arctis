// ============================================================
// ARCTIS AI Router — Fallback chain + model registry
// Supports all human workspace modes + agent modes
// ============================================================

import { callOpenRouter, streamOpenRouter, type AIRequest, type AIResponse } from '@/lib/ai/providers/openrouter';
import type { AIMode } from '@/types';

export const AI_MODELS = [
  { id: 'moonshot/kimi-k1-5-32k',           name: 'Kimi K1.5',          creditCost: 1,  provider: 'openrouter', tags: ['fast','general'] },
  { id: 'deepseek/deepseek-chat',            name: 'DeepSeek Chat',      creditCost: 1,  provider: 'openrouter', tags: ['code','general'] },
  { id: 'google/gemma-3-27b-it:free',        name: 'Gemma 3 27B',        creditCost: 1,  provider: 'openrouter', tags: ['free','general'] },
  { id: 'qwen/qwen-2.5-72b-instruct',        name: 'Qwen 2.5 72B',       creditCost: 2,  provider: 'openrouter', tags: ['reasoning','research'] },
  { id: 'openai/gpt-4o-mini',                name: 'GPT-4o Mini',        creditCost: 2,  provider: 'openrouter', tags: ['fast','reliable'] },
  { id: 'openai/gpt-4o',                     name: 'GPT-4o',             creditCost: 10, provider: 'openrouter', tags: ['powerful'] },
  { id: 'anthropic/claude-3-haiku',          name: 'Claude 3 Haiku',     creditCost: 2,  provider: 'openrouter', tags: ['fast','analysis'] },
  { id: 'anthropic/claude-3-5-sonnet',       name: 'Claude 3.5 Sonnet',  creditCost: 10, provider: 'openrouter', tags: ['powerful','analysis'] },
] as const;

export type ModelId = typeof AI_MODELS[number]['id'];

const FALLBACK_CHAIN: ModelId[] = [
  'moonshot/kimi-k1-5-32k',
  'deepseek/deepseek-chat',
  'google/gemma-3-27b-it:free',
  'qwen/qwen-2.5-72b-instruct',
];

export const MODE_DEFAULTS: Record<AIMode, ModelId> = {
  // Human workspaces
  study:       'moonshot/kimi-k1-5-32k',
  build:       'deepseek/deepseek-chat',
  analyze:     'qwen/qwen-2.5-72b-instruct',
  research:    'anthropic/claude-3-haiku',
  generate:    'openai/gpt-4o-mini',
  treasury:    'anthropic/claude-3-haiku',
  developer:   'deepseek/deepseek-chat',
  student:     'moonshot/kimi-k1-5-32k',
  // New educational roles
  teacher:     'openai/gpt-4o-mini',
  professor:   'anthropic/claude-3-haiku',
  child:       'google/gemma-3-27b-it:free',
  engineering: 'qwen/qwen-2.5-72b-instruct',
};

export const MODE_PROMPTS: Record<AIMode, string> = {
  study: `You are ARCTIS Study Mode. Help users learn and understand concepts clearly.
Break down complex topics step by step. Use examples, analogies, and clear structure.
Always check for understanding. Format with headers and bullet points when helpful.`,

  build: `You are ARCTIS Build Mode — expert software engineer.
Write clean, production-grade code with TypeScript, error handling, and comments.
Prefer Next.js App Router, wagmi v2, viem, and Arc/EVM patterns.
Always explain your implementation decisions briefly.`,

  analyze: `You are ARCTIS Analyze Mode. Perform deep, structured analysis.
Extract key insights, identify patterns, flag risks, quantify findings where possible.
Format: Executive Summary → Key Findings → Detailed Analysis → Recommendations.`,

  research: `You are ARCTIS Research Mode. Conduct thorough, multi-angle research.
Present multiple perspectives, cite logical reasoning, distinguish fact from inference.
Format: Overview → Sources & Evidence → Analysis → Conclusions.`,

  generate: `You are ARCTIS Generate Mode. Create high-quality content on demand.
Match the exact tone, format, and length requested. Produce publication-ready output.
Ask for clarification only if the request is genuinely ambiguous.`,

  treasury: `You are ARCTIS Treasury Intelligence — institutional financial analyst.
Focus on USDC treasury health, cash flow analysis, revenue accounting, and risk.
Be precise with numbers. Use tables. Flag anomalies. Never speculate on price.`,

  developer: `You are ARCTIS Developer Mode — blockchain and Web3 engineer.
Stack: Arc Testnet (Chain ID 5042002), Arc Native USDC (0x3600..., 6 decimals),
wagmi v2, viem, Next.js App Router, TypeScript strict, Tailwind, Framer Motion.
Always produce working, type-safe, production-ready code with error handling.`,

  student: `You are ARCTIS Student Tutor — patient, encouraging, and thorough.
Adapt explanations to the student's level. Use the Socratic method when appropriate.
Break complex ideas into digestible steps. Celebrate progress and correct mistakes kindly.`,

  teacher: `You are ARCTIS Teacher Assistant — curriculum design and classroom support expert.
Help create lesson plans, assignments, quizzes, MCQs, rubrics, and chapter summaries.
Format educational content clearly with learning objectives, activities, and assessments.
Differentiate content for various learning levels when asked.`,

  professor: `You are ARCTIS Academic Assistant — rigorous academic research and writing expert.
Support literature reviews, research methodology, citation formatting, paper analysis,
thesis development, and grant writing. Maintain academic precision and scholarly tone.
Cite reasoning thoroughly. Distinguish established knowledge from emerging findings.`,

  child: `You are ARCTIS Learning Assistant — friendly, safe, and encouraging for young learners.
Use simple, age-appropriate language. No complex vocabulary without explanation.
Make learning fun with examples from everyday life. Always be positive and patient.
SAFETY: Never discuss violence, adult content, or inappropriate topics.
If asked about unsafe topics, redirect warmly to a safer subject.`,

  engineering: `You are ARCTIS Engineering Assistant — technical analysis and specifications expert.
Perform calculations, diagnostics, system analysis, and generate engineering specifications.
Always show methodology and calculations step by step. Include units and safety margins.
Format: Problem Statement → Methodology → Calculations → Results → Recommendations.`,
};

export async function routeAIRequest(req: AIRequest): Promise<AIResponse> {
  const primaryModel = req.model as ModelId;
  const modelsToTry = [primaryModel, ...FALLBACK_CHAIN.filter((m) => m !== primaryModel)];
  let lastError: Error | null = null;
  for (const model of modelsToTry) {
    try {
      return await callOpenRouter({ ...req, model });
    } catch (err) {
      lastError = err as Error;
      console.warn(`[AI Router] ${model} failed, trying fallback`);
    }
  }
  throw lastError ?? new Error('All AI providers failed');
}

export async function routeAIStream(
  req: AIRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> {
  return streamOpenRouter(req, onChunk, signal);
}
