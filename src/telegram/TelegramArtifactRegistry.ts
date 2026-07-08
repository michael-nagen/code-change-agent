/**
 * In-memory {@link TelegramArtifactRegistry}.
 *
 * When the webhook renders a generated artifact it may span several Telegram
 * messages (long replies are split, and a progress message is edited into the
 * first chunk). This registry maps EVERY one of those message ids to the same
 * artifact ref, so a user replying to any chunk resolves the full artifact for
 * editing.
 *
 * It is ephemeral CONTROL state (like the chat-state store): a cold start starts
 * empty, which only means a reply to a pre-restart message falls back to the
 * friendly "I can't find that result" path. To keep memory bounded on a warm
 * instance it evicts the oldest entries past a cap. Durable product memory is
 * never stored here.
 */
import type { TelegramArtifactRef, TelegramArtifactRegistry } from './types.js';

const DEFAULT_MAX_ENTRIES = 500;

export class InMemoryTelegramArtifactRegistry implements TelegramArtifactRegistry {
  private readonly entries = new Map<string, TelegramArtifactRef>();
  private readonly maxEntries: number;

  constructor({ maxEntries = DEFAULT_MAX_ENTRIES }: { maxEntries?: number } = {}) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  register(chatId: number | string, messageIds: number[], ref: TelegramArtifactRef): void {
    for (const messageId of messageIds) {
      if (!Number.isFinite(messageId)) continue;
      const key = keyFor(chatId, messageId);
      // Re-insert so recently-used keys move to the end (Map preserves order).
      this.entries.delete(key);
      this.entries.set(key, ref);
    }
    this.evictExcess();
  }

  lookup(chatId: number | string, messageId: number): TelegramArtifactRef | undefined {
    return this.entries.get(keyFor(chatId, messageId));
  }

  private evictExcess(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

function keyFor(chatId: number | string, messageId: number): string {
  return `${chatId}\u0000${messageId}`;
}
