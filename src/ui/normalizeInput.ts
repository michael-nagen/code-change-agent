/**
 * Normalize a mode-tagged `FormSubmission` into the single
 * `{ requirementText, rawDiff }` shape the engine consumes. This is the only
 * place that performs network I/O (GitHub diff / website fetch). The engine
 * stays unchanged and mode-agnostic.
 *
 * Network access is injected as `fetchImpl` so tests can mock it and never hit
 * real GitHub/websites. No tokens, no SDKs, no crawling, no secrets.
 */
import type { FormSubmission, NormalizedInput } from './types.js';

/** Minimal response shape we depend on; `fetch`'s `Response` satisfies it. */
export interface MinimalResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (url: string) => Promise<MinimalResponse>;

/** Default network impl: the global `fetch`, wrapped to the minimal contract. */
export const defaultFetch: FetchLike = (url) => fetch(url);

/** Cap extracted website text so a huge page can't bloat the prompt. */
const MAX_WEBSITE_TEXT = 20000;

/**
 * Convert a public GitHub PR or commit URL into its `.diff` URL.
 *
 * Accepts (with or without a trailing slash or existing `.diff`/`.patch`):
 *   https://github.com/owner/repo/pull/123
 *   https://github.com/owner/repo/commit/<sha>
 * Throws a clear error for any non-github.com or unsupported URL.
 */
export function toGitHubDiffUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid GitHub URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('GitHub URL must use http or https.');
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    throw new Error('Only public github.com URLs are supported.');
  }

  const path = parsed.pathname.replace(/\/+$/, '').replace(/\.(diff|patch)$/i, '');
  const isPr = /^\/[^/]+\/[^/]+\/pull\/\d+$/.test(path);
  const isCommit = /^\/[^/]+\/[^/]+\/commit\/[0-9a-fA-F]{7,40}$/.test(path);
  if (!isPr && !isCommit) {
    throw new Error(
      'Unsupported GitHub URL. Use a PR URL (…/pull/123) or a commit URL (…/commit/<sha>).',
    );
  }

  return `https://github.com${path}.diff`;
}

/**
 * Extract readable text from an HTML document in a simple, safe way: strip
 * scripts/styles/comments/tags and decode common entities. This is not a parser
 * or a crawler — it follows no links and fetches nothing else.
 */
export function extractReadableText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<\/(p|div|section|article|header|footer|li|ul|ol|h[1-6]|tr|table)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/[ \t\f\v\r]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  return text.length > MAX_WEBSITE_TEXT ? text.slice(0, MAX_WEBSITE_TEXT) : text;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function assertHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid website URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Website URL must use http or https.');
  }
  return parsed;
}

async function normalizeGitHub(
  submission: FormSubmission,
  fetchImpl: FetchLike,
): Promise<NormalizedInput> {
  if (submission.githubUrl === '') {
    throw new Error('GitHub URL is required for GitHub URL mode.');
  }
  const diffUrl = toGitHubDiffUrl(submission.githubUrl);

  let res: MinimalResponse;
  try {
    res = await fetchImpl(diffUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach GitHub to fetch the diff: ${reason}`);
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `GitHub diff not found (404). The PR/commit may be private or may not exist: ${diffUrl}`,
      );
    }
    throw new Error(`Failed to fetch GitHub diff (HTTP ${res.status}): ${diffUrl}`);
  }

  const diff = await res.text();
  if (diff.trim() === '') {
    throw new Error('The fetched GitHub diff is empty.');
  }

  return { requirementText: submission.requirementText, rawDiff: diff };
}

async function normalizeWebsite(
  submission: FormSubmission,
  fetchImpl: FetchLike,
): Promise<NormalizedInput> {
  // Website context provides requirement text only — the diff is still required.
  if (submission.rawDiff.trim() === '') {
    throw new Error('Website context mode still requires a raw diff in the diff field.');
  }
  if (submission.websiteUrl === '') {
    throw new Error('Website URL is required for Website Context mode.');
  }
  const parsed = assertHttpUrl(submission.websiteUrl);

  let res: MinimalResponse;
  try {
    res = await fetchImpl(parsed.toString());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the website: ${reason}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch website (HTTP ${res.status}).`);
  }

  const text = extractReadableText(await res.text());
  if (text === '') {
    throw new Error('No readable text could be extracted from the website.');
  }

  return { requirementText: text, rawDiff: submission.rawDiff };
}

/**
 * Resolve a submission into `{ requirementText, rawDiff }` according to its
 * `inputMode`. Manual/Notion are pure (no network); GitHub/Website fetch via the
 * injected `fetchImpl`. Throws clear, user-facing errors on any failure.
 */
export async function normalizeInput({
  submission,
  fetchImpl = defaultFetch,
}: {
  submission: FormSubmission;
  fetchImpl?: FetchLike;
}): Promise<NormalizedInput> {
  switch (submission.inputMode) {
    case 'manual':
      return { requirementText: submission.requirementText, rawDiff: submission.rawDiff };
    case 'githubUrl':
      return normalizeGitHub(submission, fetchImpl);
    case 'websiteContextUrl':
      return normalizeWebsite(submission, fetchImpl);
    case 'notionText':
      // Notion text is identity-normalized: pasted content becomes the
      // requirement, the diff comes from the textarea. (The existing
      // NotionInputAdapter also supports a rawText path, but the UI keeps the
      // same runAnalysis flow and does not implement real Notion OAuth/API.)
      return { requirementText: submission.notionText, rawDiff: submission.rawDiff };
    default: {
      const exhaustive: never = submission.inputMode;
      throw new Error(`Unsupported inputMode: ${String(exhaustive)}`);
    }
  }
}
