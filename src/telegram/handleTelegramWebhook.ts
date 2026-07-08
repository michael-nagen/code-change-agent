/**
 * The Telegram webhook boundary.
 *
 * Order of operations (per the integration spec):
 *   1. validate the webhook secret (when configured);
 *   2. parse the Telegram update;
 *   3. resolve the chat id;
 *   4. check the allow-list — unauthorized chats never see project data;
 *   5. parse the command;
 *   6. execute it via the existing command service (read-only);
 *   7. send the reply through the Telegram API.
 *
 * It never throws for expected failures; it returns a structured result the HTTP
 * layer maps to a response. The bot token is not handled here and is never logged.
 */
import { parseTelegramCommand } from './parseTelegramCommand.js';
import type { TelegramCommandService } from './TelegramCommandService.js';
import type {
  TelegramApi,
  TelegramConfig,
  TelegramUpdate,
  TelegramWebhookResult,
} from './types.js';

export async function handleTelegramWebhook({
  update,
  secretHeader,
  config,
  service,
  api,
}: {
  update: unknown;
  /** Value of the `X-Telegram-Bot-Api-Secret-Token` header, if any. */
  secretHeader?: string;
  config: TelegramConfig;
  service: TelegramCommandService;
  api: TelegramApi;
}): Promise<TelegramWebhookResult> {
  // 1. Secret validation. When a secret is configured it MUST match.
  if (config.webhookSecret !== undefined && secretHeader !== config.webhookSecret) {
    return { statusCode: 401, body: { ok: false, description: 'Invalid webhook secret.' } };
  }

  // 2. Parse the update and 3. resolve the chat id.
  const message = extractMessage(update);
  const chatId = message?.chat?.id;
  if (message === undefined || chatId === undefined) {
    // Nothing actionable (e.g. a non-message update) — acknowledge so Telegram
    // does not retry.
    return { statusCode: 200, body: { ok: true, description: 'No actionable message.' } };
  }

  // 4. Authorization. Unauthorized chats are told they lack access — never data.
  if (!isChatAllowed({ chatId, allowedChatIds: config.allowedChatIds })) {
    await trySend(api, chatId, 'This chat is not authorized to use this bot.');
    return { statusCode: 200, body: { ok: true, description: 'Chat not authorized.' } };
  }

  // 5. Parse the command (command name + raw remainder, spacing preserved).
  const parsed = parseTelegramCommand(message.text);
  if (parsed === undefined) {
    await trySend(api, chatId, 'Send /help to see available commands.');
    return { statusCode: 200, body: { ok: true, description: 'Not a command.' } };
  }

  // 6. Execute via the existing service and 7. reply. The chat id keys the
  // per-chat control state (active project, last session, pending save/clear).
  let reply: string;
  try {
    reply = await service.run({ command: parsed.command, argsText: parsed.argsText, chatId });
  } catch (err) {
    reply = `Sorry, that command failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  await trySend(api, chatId, reply);
  return { statusCode: 200, body: { ok: true } };
}

/** True when the chat id is on the allow-list. An empty list denies everyone. */
export function isChatAllowed({
  chatId,
  allowedChatIds,
}: {
  chatId: number | string;
  allowedChatIds: string[];
}): boolean {
  if (allowedChatIds.length === 0) return false;
  return allowedChatIds.includes(String(chatId));
}

function extractMessage(update: unknown): TelegramUpdate['message'] {
  if (typeof update !== 'object' || update === null) return undefined;
  const u = update as TelegramUpdate;
  return u.message ?? u.edited_message;
}

async function trySend(api: TelegramApi, chatId: number | string, text: string): Promise<void> {
  try {
    await api.sendMessage({ chatId, text });
  } catch {
    // A send failure must not turn into a 500 that makes Telegram retry forever.
  }
}
