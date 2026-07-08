/**
 * Richer, still-PURE parsing of a Telegram command line, layered on the bare
 * `parseCommand`. It keeps the raw remainder (`argsText`, spaces preserved) so a
 * multi-word project name or a pasted spec/diff survives, plus the token list.
 *
 * The command-specific helpers below interpret that remainder without any I/O:
 *  - `parseInlineSpecDiff` pulls `spec:` / `diff:` sections out of `/analyze`;
 *  - `parseConfirmFlag` detects `/clear confirm`;
 *  - `parseSaveSource` reads `daily` | `weekly` for `/save`.
 */
import { parseCommand } from './parseCommand.js';
import type { ParsedTelegramCommand, TelegramSaveSource } from './types.js';

export function parseTelegramCommand(
  text: string | undefined,
): ParsedTelegramCommand | undefined {
  const base = parseCommand(text);
  if (base === undefined || text === undefined) return undefined;

  // Recover the raw remainder after the command token, preserving spacing so a
  // project name like "Developer Work Companion" or a pasted diff is intact.
  const trimmed = text.trim();
  const afterSlash = trimmed.slice(1);
  const firstWhitespace = afterSlash.search(/\s/);
  const argsText = firstWhitespace === -1 ? '' : afterSlash.slice(firstWhitespace + 1).trim();

  return { command: base.command, args: base.args, argsText };
}

/** The result of splitting `/analyze` arguments into optional project + spec/diff. */
export interface InlineAnalyzeInput {
  /** A leading project name (text before any `spec:`/`diff:` marker), if any. */
  projectName?: string;
  /** Pasted spec/requirement text following a `spec:` marker, if any. */
  spec?: string;
  /** Pasted diff text following a `diff:` marker, if any. */
  diff?: string;
}

/**
 * Split an `/analyze` argument string into an optional leading project name and
 * optional `spec:` / `diff:` sections (order-independent). Everything before the
 * first marker is treated as the project name. Nothing is invented: a missing
 * marker simply yields an absent field.
 */
export function parseInlineSpecDiff(argsText: string): InlineAnalyzeInput {
  const text = argsText.trim();
  if (text === '') return {};

  const specMarker = findMarker(text, 'spec');
  const diffMarker = findMarker(text, 'diff');

  // No markers: the whole remainder is a project name.
  if (specMarker === -1 && diffMarker === -1) {
    return { projectName: text };
  }

  const markers = [
    ...(specMarker !== -1 ? [{ kind: 'spec' as const, at: specMarker }] : []),
    ...(diffMarker !== -1 ? [{ kind: 'diff' as const, at: diffMarker }] : []),
  ].sort((a, b) => a.at - b.at);

  const firstAt = markers[0]?.at ?? text.length;
  const leading = text.slice(0, firstAt).trim();

  const result: InlineAnalyzeInput = {};
  if (leading !== '') result.projectName = leading;

  markers.forEach((marker, index) => {
    const valueStart = marker.at + marker.kind.length + 1; // skip "spec:"/"diff:"
    const valueEnd = markers[index + 1]?.at ?? text.length;
    const value = text.slice(valueStart, valueEnd).trim();
    if (value === '') return;
    if (marker.kind === 'spec') result.spec = value;
    else result.diff = value;
  });

  return result;
}

/** Find a case-insensitive `<keyword>:` marker's index, or -1 when absent. */
function findMarker(text: string, keyword: 'spec' | 'diff'): number {
  const match = new RegExp(`(^|\\s)${keyword}:`, 'i').exec(text);
  if (match === null) return -1;
  // Point at the keyword itself, not the preceding whitespace captured by group 1.
  return match.index + (match[1]?.length ?? 0);
}

/** True when the tokens contain a standalone `confirm` (for `/clear confirm`). */
export function parseConfirmFlag(args: string[]): boolean {
  return args.some((a) => a.toLowerCase() === 'confirm');
}

/** Read an explicit `/save daily|weekly` source from the tokens, if present. */
export function parseSaveSource(args: string[]): TelegramSaveSource | undefined {
  for (const arg of args) {
    const lower = arg.toLowerCase();
    if (lower === 'daily') return 'daily';
    if (lower === 'weekly') return 'weekly';
  }
  return undefined;
}
