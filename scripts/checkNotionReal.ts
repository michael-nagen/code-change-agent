/**
 * Manual / ops smoke test for the REAL Notion integration.
 *
 * Read-only by default:   npm run check:notion:real
 * Read + tiny append:     NOTION_WRITE_SMOKE_TEST=true npm run check:notion:real
 *
 * It answers: "with real credentials, can the app actually reach Notion, read
 * the configured page, and (only when explicitly allowed) append a block?" It
 * uses the SAME env-driven wiring the app uses (`resolveHarnessSourceDeps`), so
 * a success here means the real connector is configured correctly.
 *
 * Required env (configured outside this repo, e.g. in .env):
 *   SOURCE_INTEGRATIONS_ENABLED=true
 *   NOTION_API_KEY=...            (never printed)
 *   NOTION_DEFAULT_PAGE_ID=...
 *
 * Safety:
 *  - it NEVER prints NOTION_API_KEY (or any secret); the page id is shown
 *    redacted (last few chars only);
 *  - it only READS unless NOTION_WRITE_SMOKE_TEST=true is set;
 *  - the single test append is a short, clearly-labelled line.
 *
 * It is intentionally NOT a unit test (needs real credentials, never run by CI).
 */
import 'dotenv/config';

import { resolveHarnessSourceDeps } from '../src/ui/index.js';

async function main(): Promise<void> {
  console.log('Notion real smoke test\n');

  const enabled = (process.env.SOURCE_INTEGRATIONS_ENABLED ?? '').trim().toLowerCase();
  if (enabled !== 'true' && enabled !== '1' && enabled !== 'yes' && enabled !== 'on') {
    fail('SOURCE_INTEGRATIONS_ENABLED must be true. Set it (plus NOTION_API_KEY and NOTION_DEFAULT_PAGE_ID) and retry.');
  }
  if ((process.env.NOTION_API_KEY ?? '').trim() === '') {
    fail('NOTION_API_KEY is missing. Set it in the environment (it is never printed).');
  }

  const { notionConnector, sourceDefaults } = resolveHarnessSourceDeps(process.env);
  if (notionConnector === undefined) {
    fail('No Notion connector was constructed. Ensure SOURCE_INTEGRATIONS_ENABLED=true and NOTION_API_KEY is set.');
  }
  console.log('Connector wiring: OK (real HttpNotionConnector)');

  const pageId = sourceDefaults.notionPageId?.trim() ?? '';
  if (pageId === '') {
    fail('NOTION_DEFAULT_PAGE_ID is missing. Set the page id/URL to read/write.');
  }
  console.log(`Target page: ${redact(pageId)}`);

  // 1-2. Connect + read the configured page.
  const page = await guard({ label: 'Read page', run: () => notionConnector.readPage({ pageIdOrUrl: pageId }) });
  console.log(`  title: ${page.source.title ?? '(untitled)'}`);
  console.log(`  chars fetched: ${page.text.length}`);

  // 3. Conditional, explicit-only append.
  const writeAllowed = (process.env.NOTION_WRITE_SMOKE_TEST ?? '').trim().toLowerCase() === 'true';
  if (!writeAllowed) {
    console.log('\nWrite smoke test: skipped (read-only).');
    console.log('  To append a tiny test block, run: NOTION_WRITE_SMOKE_TEST=true npm run check:notion:real');
    console.log('\nResult: Notion real READ is connected and working.');
    return;
  }

  if (notionConnector.appendToPage === undefined) {
    fail('The connector does not support appendToPage, so write-back cannot be smoke-tested.');
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const content = [
    `Notion integration smoke test — ${stamp}`,
    'This is a test append from Developer Work Companion.',
  ].join('\n');
  await guard({
    label: 'Append test block',
    run: () => notionConnector.appendToPage!({ pageIdOrUrl: pageId, content }),
  });

  console.log('\nResult: Notion real READ + WRITE is connected and working.');
}

/** Show only the last 6 chars of a page id/URL; mask the rest. */
function redact(pageId: string): string {
  const trimmed = pageId.replace(/[?#].*$/, '');
  const tail = trimmed.slice(-6);
  return `…${tail}`;
}

async function guard<T>({ label, run }: { label: string; run: () => Promise<T> | T }): Promise<T> {
  try {
    const result = await run();
    console.log(`${label}: OK`);
    return result;
  } catch (err) {
    throw new CheckError(`${label} failed.\n  detail: ${scrub(err instanceof Error ? err.message : String(err))}`);
  }
}

class CheckError extends Error {}

function fail(message: string): never {
  throw new CheckError(message);
}

/** Never let the API key (or common secret env values) appear in output. */
function scrub(message: string): string {
  let out = message;
  for (const key of ['NOTION_API_KEY', 'OPENAI_API_KEY', 'DATABASE_URL']) {
    const value = process.env[key];
    if (value !== undefined && value !== '') out = out.split(value).join('[redacted]');
  }
  return out;
}

main().catch((err: unknown) => {
  const message = err instanceof CheckError ? err.message : scrub(err instanceof Error ? err.message : String(err));
  console.error(`\nResult: FAILED\n${message}`);
  process.exit(1);
});
