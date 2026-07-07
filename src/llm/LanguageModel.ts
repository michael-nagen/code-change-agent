/**
 * Shared injectable LanguageModel port.
 *
 * All skills depend only on this interface — never on a concrete adapter.
 * This keeps the model provider swappable without changing skill logic.
 */

export interface LanguageModelInput {
  prompt: string;
}

export interface LanguageModelOutput {
  text: string;
}

export interface LanguageModel {
  readonly name: string;
  generate(input: LanguageModelInput): Promise<LanguageModelOutput>;
}
