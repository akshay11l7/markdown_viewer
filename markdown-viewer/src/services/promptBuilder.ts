/**
 * Prompt Builder
 *
 * Reusable prompt template functions for each AI action.
 * These are used client-side to provide descriptive user messages in the chat,
 * while the actual system/user prompts for Grok are constructed server-side.
 *
 * This module ensures consistent prompt formatting and avoids duplicated strings.
 */

import type {
  WritingTone,
  SummaryMode,
  ExplanationLevel,
  TranslateLanguage,
  DifficultyLevel,
} from '../types/ai';

// ─── Display Labels ───────────────────────────────────────────────────────────

/** Human-readable labels for writing tones */
export const TONE_LABELS: Record<WritingTone, string> = {
  professional: 'Professional',
  simple: 'Simple & Clear',
  technical: 'Technical',
  academic: 'Academic',
  friendly: 'Friendly & Casual',
};

/** Human-readable labels for summary modes */
export const SUMMARY_MODE_LABELS: Record<SummaryMode, string> = {
  short: 'Short (2-3 sentences)',
  medium: 'Medium (1-2 paragraphs)',
  detailed: 'Detailed (comprehensive)',
};

/** Human-readable labels for explanation levels */
export const EXPLANATION_LEVEL_LABELS: Record<ExplanationLevel, string> = {
  simplified: 'Simplified',
  technical: 'Technical',
  beginner: 'Beginner-Friendly',
};

/** Human-readable labels for translation languages */
export const LANGUAGE_LABELS: Record<TranslateLanguage, string> = {
  english: 'English',
  hindi: 'Hindi',
  french: 'French',
  german: 'German',
  japanese: 'Japanese',
  spanish: 'Spanish',
};

/** Human-readable labels for difficulty levels */
export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// ─── User-Facing Prompt Descriptions ──────────────────────────────────────────

/**
 * Build a user-visible description for the summary action.
 */
export function buildSummaryPrompt(mode: SummaryMode): string {
  return `Summarize this document (${SUMMARY_MODE_LABELS[mode]})`;
}

/**
 * Build a user-visible description for the explain action.
 */
export function buildExplainPrompt(text: string, level: ExplanationLevel): string {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  return `Explain: "${preview}" (${EXPLANATION_LEVEL_LABELS[level]})`;
}

/**
 * Build a user-visible description for the grammar action.
 */
export function buildGrammarPrompt(text: string): string {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  return `Fix grammar: "${preview}"`;
}

/**
 * Build a user-visible description for the rewrite/improve action.
 */
export function buildRewritePrompt(text: string, tone: WritingTone): string {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  return `Improve writing (${TONE_LABELS[tone]}): "${preview}"`;
}

/**
 * Build a user-visible description for the translation action.
 */
export function buildTranslationPrompt(text: string, language: TranslateLanguage): string {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  return `Translate to ${LANGUAGE_LABELS[language]}: "${preview}"`;
}

/**
 * Build a user-visible description for the mermaid diagram action.
 */
export function buildMermaidPrompt(description: string): string {
  const preview = description.length > 60 ? description.slice(0, 60) + '...' : description;
  return `Generate Mermaid diagram: "${preview}"`;
}

/**
 * Build a user-visible description for the FAQ action.
 */
export function buildFAQPrompt(): string {
  return 'Generate FAQ section from this document';
}

/**
 * Build a user-visible description for the flashcard action.
 */
export function buildFlashcardPrompt(): string {
  return 'Create study flashcards from this document';
}

/**
 * Build a user-visible description for TOC generation.
 */
export function buildTOCPrompt(): string {
  return 'Generate Table of Contents';
}

/**
 * Build a user-visible description for interview questions.
 */
export function buildInterviewPrompt(difficulty: DifficultyLevel): string {
  return `Generate interview questions (${DIFFICULTY_LABELS[difficulty]})`;
}

/**
 * Build a user-visible description for document insights.
 */
export function buildInsightsPrompt(): string {
  return 'Analyze document and provide insights';
}

/**
 * Build a user-visible description for title generation.
 */
export function buildTitlesPrompt(): string {
  return 'Generate 5 title suggestions';
}

/**
 * Build a user-visible description for markdown conversion.
 */
export function buildMarkdownConvertPrompt(text: string): string {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  return `Convert to Markdown: "${preview}"`;
}
