/**
 * Parse a Telegram message into a bot command. Pure and side-effect free.
 *
 * Accepts the standard Telegram forms:
 *   /status
 *   /status@MyBot            (the @bot suffix is stripped)
 *   /status myproject arg2   (trailing args are split on whitespace)
 *
 * Returns `undefined` when the text is not a command (does not start with '/').
 */
import type { ParsedCommand } from './types.js';

export function parseCommand(text: string | undefined): ParsedCommand | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return undefined;

  const parts = trimmed.slice(1).split(/\s+/).filter((p) => p !== '');
  if (parts.length === 0) return undefined;

  const rawCommand = parts[0] ?? '';
  // Strip a "@botname" suffix (Telegram adds it in group chats).
  const command = (rawCommand.split('@')[0] ?? '').toLowerCase();
  if (command === '') return undefined;

  return { command, args: parts.slice(1) };
}
