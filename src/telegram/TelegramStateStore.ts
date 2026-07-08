/**
 * In-memory per-chat CONTROL state.
 *
 * This is deliberately tiny and NOT durable product memory: it holds only the
 * conversational control state needed for multi-step flows (active project,
 * last session for on-demand generation, a pending save source, a pending clear
 * confirmation). Project Memory — the durable product memory — lives in the
 * MemoryStore, never here.
 *
 * Like the UI's `UiSessionStore`, it is in-memory by design: state is lost on
 * restart, which is fine for control state. It is exposed behind the
 * `TelegramStateStore` interface so a durable implementation could be swapped in
 * later without touching the command service.
 */
import type { TelegramChatState, TelegramStateStore } from './types.js';

export class InMemoryTelegramStateStore implements TelegramStateStore {
  private readonly states = new Map<string, TelegramChatState>();

  get(chatId: number | string): TelegramChatState {
    return this.states.get(String(chatId)) ?? {};
  }

  update(chatId: number | string, patch: Partial<TelegramChatState>): TelegramChatState {
    const key = String(chatId);
    const merged: TelegramChatState = { ...this.states.get(key), ...patch };
    this.states.set(key, merged);
    return merged;
  }
}
