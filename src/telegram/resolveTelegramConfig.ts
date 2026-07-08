/**
 * Config-driven Telegram setup. This is the single seam where Telegram is turned
 * on from environment variables.
 *
 * Rules (mirroring the source-connector resolver):
 *  - Telegram is DISABLED unless a bot token is provided;
 *  - the bot token is read from env, never hardcoded or logged;
 *  - an empty allow-list means the bot is CLOSED (deny-all), so memory is never
 *    exposed by an unconfigured deployment — this is called out as a warning.
 *
 * Env:
 *  - TELEGRAM_BOT_TOKEN         (required to enable)
 *  - TELEGRAM_WEBHOOK_SECRET    (optional; validated against Telegram's header)
 *  - TELEGRAM_ALLOWED_CHAT_IDS  (comma/space separated; empty => closed)
 *  - TELEGRAM_DEFAULT_PROJECT   (optional default project for commands)
 *  - TELEGRAM_WEBHOOK_URL       (optional; used by setup docs / setWebhook)
 */
import type { ResolvedTelegramConfig, TelegramConfig } from './types.js';

export function resolveTelegramConfig({
  env = process.env,
}: {
  env?: Record<string, string | undefined>;
} = {}): ResolvedTelegramConfig {
  const botToken = trimmed(env.TELEGRAM_BOT_TOKEN);
  if (botToken === undefined) {
    return { enabled: false, warnings: [] };
  }

  const warnings: string[] = [];
  const allowedChatIds = parseChatIds(env.TELEGRAM_ALLOWED_CHAT_IDS);
  if (allowedChatIds.length === 0) {
    warnings.push(
      'TELEGRAM_ALLOWED_CHAT_IDS is empty — the bot is CLOSED and will reject every chat. Set at least one chat id to allow access.',
    );
  }

  const webhookSecret = trimmed(env.TELEGRAM_WEBHOOK_SECRET);
  if (webhookSecret === undefined) {
    warnings.push(
      'TELEGRAM_WEBHOOK_SECRET is not set — incoming webhook requests are not verified. Set a secret and register it with setWebhook.',
    );
  }

  const defaultProject = trimmed(env.TELEGRAM_DEFAULT_PROJECT);
  const webhookUrl = trimmed(env.TELEGRAM_WEBHOOK_URL);
  const config: TelegramConfig = {
    botToken,
    allowedChatIds,
    ...(webhookSecret !== undefined ? { webhookSecret } : {}),
    ...(defaultProject !== undefined ? { defaultProject } : {}),
    ...(webhookUrl !== undefined ? { webhookUrl } : {}),
  };

  return { enabled: true, config, warnings };
}

/** Split a comma/space/newline separated list of chat ids into trimmed entries. */
export function parseChatIds(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function trimmed(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
}
