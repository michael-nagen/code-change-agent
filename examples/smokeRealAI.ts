/**
 * Manual / dev-only smoke test against a REAL OpenAI-compatible provider.
 *
 * This is intentionally NOT a unit test (it is not under src/**.test.ts and is
 * never run by `npm test`). It exercises the full analysis pipeline end-to-end
 * with every output skill enabled, using a live model.
 *
 * Run with:  npm run smoke:real-ai
 *
 * Required env:
 *   OPENAI_API_KEY   the provider API key (never printed)
 *   OPENAI_MODEL     the model id (e.g. gpt-4o-mini)
 * Optional env:
 *   OPENAI_BASE_URL  override the endpoint for OpenAI-compatible gateways
 *
 * It fails clearly (exit code 1) if required env vars are missing, and never
 * prints secrets.
 *
 * `.env` is loaded here (dev-only) via dotenv so you can keep your key in a
 * file instead of prefixing it on the command line. A missing `.env` is fine —
 * dotenv ignores it and the missing-config guard below still fires clearly.
 */
import 'dotenv/config';

import {
  AnalysisHarness,
  OpenAICompatibleLanguageModel,
  type AnalysisResult,
} from '../src/index.js';

const rawDiff = `diff --git a/src/cache.ts b/src/cache.ts
new file mode 100644
--- /dev/null
+++ b/src/cache.ts
@@ -0,0 +1,12 @@
+const store = new Map<string, { value: unknown; expiresAt: number }>();
+
+export function setCache(key: string, value: unknown, ttlMs: number): void {
+  store.set(key, { value, expiresAt: Date.now() + ttlMs });
+}
+
+export function getCache(key: string): unknown {
+  const entry = store.get(key);
+  if (entry === undefined) return undefined;
+  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
+  return entry.value;
+}`;

const requirementText =
  'Add a simple in-memory cache with per-entry time-to-live (TTL) so repeated lookups can be served without recomputation, and expired entries are evicted on read.';

async function main(): Promise<void> {
  // Build the real provider from env. Fails clearly if config is missing.
  const model = OpenAICompatibleLanguageModel.fromEnv();
  console.log(`Provider: ${model.name}`);
  console.log('Running full pipeline (all output skills enabled)...\n');

  const harness = new AnalysisHarness({ model });

  const result = await harness.runAnalysis({
    rawDiff,
    requirementText,
    includeFlow: true,
    includeGapReport: true,
    includeVideoScript: true,
    includePrDescription: true,
    includeDailyUpdate: true,
  });

  reportArtifacts(result);
}

/** Prints WHICH artifacts were produced (keys + tiny labels), never full dumps. */
function reportArtifacts(result: AnalysisResult): void {
  const produced: string[] = ['requirementInput', 'changeExplanation', 'requirementAlignment'];
  if (result.flowArtifact !== undefined) produced.push('flowArtifact');
  if (result.gapReport !== undefined) produced.push('gapReport');
  if (result.prDescription !== undefined) produced.push('prDescription');
  if (result.videoScript !== undefined) produced.push('videoScript');
  if (result.dailyUpdate !== undefined) produced.push('dailyUpdate');

  console.log(`Session: ${result.sessionId}`);
  console.log(`Artifacts produced (${produced.length}): ${produced.join(', ')}`);
  console.log('\nLabels:');
  console.log(`  changeExplanation.changeStory: ${truncate(result.changeExplanation.changeStory)}`);
  console.log(`  requirementAlignment.confidence: ${result.requirementAlignment.confidence}`);
  if (result.gapReport !== undefined) {
    console.log(`  gapReport.readiness: ${result.gapReport.readiness}`);
  }
  if (result.flowArtifact !== undefined) {
    console.log(`  flowArtifact.title: ${truncate(result.flowArtifact.title)}`);
  }
  if (result.prDescription !== undefined) {
    console.log(`  prDescription.title: ${truncate(result.prDescription.title)}`);
  }
  if (result.videoScript !== undefined) {
    console.log(`  videoScript.title: ${truncate(result.videoScript.title)}`);
  }
  if (result.dailyUpdate !== undefined) {
    console.log(`  dailyUpdate.headline: ${truncate(result.dailyUpdate.headline)}`);
  }

  const expected = 8;
  if (produced.length < expected) {
    throw new Error(`Expected ${expected} artifacts, produced ${produced.length}.`);
  }
  console.log('\nSMOKE OK');
}

function truncate(text: string, max = 100): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

main().catch((err: unknown) => {
  // Print the message only (no stack with potential context, no secrets).
  console.error(`SMOKE FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
