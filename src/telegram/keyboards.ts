/**
 * Keyboard builders — the native Telegram UX layer.
 *
 * Pure functions that produce our storage-agnostic keyboard markup. Two kinds:
 *  - REPLY keyboards (persistent quick-reply buttons) for common navigation;
 *  - INLINE keyboards (buttons under a message) for contextual actions.
 *
 * Inline button callback data is a normal command line (e.g. "/save daily") so a
 * tap reuses the exact same dispatch path as a typed command — no parallel logic.
 * Telegram caps callback data at 64 bytes, so builders skip buttons that would
 * exceed it rather than sending a truncated, broken payload.
 */
import type {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  TelegramArtifactKind,
} from './types.js';

const CALLBACK_DATA_MAX = 64;

/** The persistent quick-action menu shown after /start and /help. */
export function mainMenuKeyboard(): ReplyKeyboardMarkup {
  return {
    kind: 'reply',
    resize: true,
    rows: [
      ['/status', '/projects'],
      ['/analyze', '/daily'],
      ['/latest', '/help'],
    ],
  };
}

/** Contextual actions offered right after an analysis run completes. */
export function generationKeyboard(): InlineKeyboardMarkup {
  return inlineGrid([
    { text: '📄 Daily', callbackData: '/daily' },
    { text: '🛠 Technical', callbackData: '/technical' },
    { text: '🎬 Demo', callbackData: '/demo' },
    { text: '📅 Weekly', callbackData: '/weekly' },
  ]);
}

/** A one-tap save button shown under a freshly generated daily/weekly artifact. */
export function saveKeyboard(source: 'daily' | 'weekly'): InlineKeyboardMarkup {
  return {
    kind: 'inline',
    rows: [[{ text: `💾 Save ${source} to memory`, callbackData: `/save ${source}` }]],
  };
}

/** The confirm/cancel pair for a destructive /clear. */
export function clearConfirmKeyboard(): InlineKeyboardMarkup {
  return {
    kind: 'inline',
    rows: [
      [
        { text: '✅ Confirm clear', callbackData: '/clear confirm' },
        { text: '✖ Cancel', callbackData: '/status' },
      ],
    ],
  };
}

/**
 * A picker for saved projects: each button opens that project's status. Ids that
 * would overflow the callback-data budget are dropped (the list still shows them
 * as text elsewhere), and the list is capped so the keyboard stays tappable.
 */
export function projectsKeyboard(projectIds: string[], max = 8): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[] = [];
  for (const id of projectIds.slice(0, max)) {
    const callbackData = `/status ${id}`;
    if (byteLength(callbackData) <= CALLBACK_DATA_MAX) {
      buttons.push({ text: id, callbackData });
    }
  }
  return inlineGrid(buttons, 2);
}

/**
 * Actions offered under a generated/edited artifact. Every button is a command
 * line (reusing the single dispatch path): Save (daily/weekly only), Notion
 * (daily/weekly/demo), Edit again (`/edit` explains reply-to-edit), and Latest.
 * The message text also invites a direct reply to edit again.
 */
export function editResultKeyboard(artifact: TelegramArtifactKind): InlineKeyboardMarkup {
  const primary: InlineKeyboardButton[] = [];
  if (artifact === 'daily') primary.push({ text: '💾 Save', callbackData: '/save daily' });
  if (artifact === 'weekly') primary.push({ text: '💾 Save', callbackData: '/save weekly' });
  const notionSub = NOTION_SUB_FOR[artifact];
  if (notionSub !== undefined) {
    primary.push({ text: '📤 Notion', callbackData: `/notion ${notionSub}` });
  }

  const rows: InlineKeyboardButton[][] = [];
  if (primary.length > 0) rows.push(primary);
  rows.push([
    { text: '✏️ Edit again', callbackData: '/edit' },
    { text: '🔁 Latest', callbackData: '/latest' },
  ]);
  return { kind: 'inline', rows };
}

/** Which `/notion` sub-command (if any) applies to each artifact kind. */
const NOTION_SUB_FOR: Partial<Record<TelegramArtifactKind, string>> = {
  daily: 'daily',
  weekly: 'weekly',
  demo: 'demo',
};

/** Arrange buttons into rows of `perRow`. */
function inlineGrid(buttons: InlineKeyboardButton[], perRow = 2): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return { kind: 'inline', rows };
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}
