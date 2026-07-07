/**
 * Re-export shim — the canonical interface lives in src/llm/LanguageModel.ts.
 * Kept here so existing imports within this module and the barrel continue to
 * resolve without modification.
 */
export type { LanguageModelInput, LanguageModelOutput, LanguageModel } from '../../llm/LanguageModel.js';
