import type {
  LanguageModel,
  LanguageModelInput,
  LanguageModelOutput,
} from '../../llm/LanguageModel.js';

/**
 * A configurable, provider-free LanguageModel for unit tests.
 *
 * Unlike MockLanguageModel (which returns a fixed ChangeExplanation), this fake
 * returns whatever text the test supplies — a fixed string or a function of the
 * prompt — and records every call so a test can assert it was invoked exactly
 * once and inspect the prompt it received.
 */
export class FakeLanguageModel implements LanguageModel {
  readonly name = 'fake-language-model';
  readonly calls: LanguageModelInput[] = [];
  private readonly responder: (input: LanguageModelInput) => string;

  constructor(response: string | ((input: LanguageModelInput) => string)) {
    this.responder = typeof response === 'function' ? response : () => response;
  }

  async generate(input: LanguageModelInput): Promise<LanguageModelOutput> {
    this.calls.push(input);
    return { text: this.responder(input) };
  }
}
