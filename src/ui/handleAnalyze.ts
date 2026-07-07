/**
 * The analyze handler: the single boundary the Run Analysis button calls.
 *
 * It parses the mode-tagged submission, normalizes it into
 * `{ requirementText, rawDiff }` (fetching a GitHub diff or website text when
 * the mode requires it), delegates to the injected runner (real harness or
 * mock), renders the result into viewer tabs, and maps any failure into a
 * structured error response whose `message` is the ACTUAL error text (shown
 * verbatim in the UI). It never throws for engine/validation/fetch failures.
 */
import type { AnalysisRequest, AnalysisRunner, AnalyzeResponse, UiMode } from './types.js';
import { parseFormSubmission, RequestParseError } from './parseRequest.js';
import { normalizeInput, type FetchLike } from './normalizeInput.js';
import { renderWorkspaceCards } from './features/artifactViews/index.js';
import type { UiSessionStore } from './sessionStore.js';

export async function handleAnalyze({
  runner,
  mode,
  body,
  fetchImpl,
  store,
}: {
  runner: AnalysisRunner;
  mode: UiMode;
  body: unknown;
  /** Injectable network impl for URL modes; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Optional UI session cache; populated so chat editing can reuse artifacts. */
  store?: UiSessionStore;
}): Promise<AnalyzeResponse> {
  let submission;
  try {
    submission = parseFormSubmission(body);
  } catch (error) {
    const message = error instanceof RequestParseError ? error.message : 'Invalid request body.';
    return { status: 'error', mode, message };
  }

  try {
    const { requirementText, rawDiff } = await normalizeInput({
      submission,
      ...(fetchImpl !== undefined ? { fetchImpl } : {}),
    });

    const request: AnalysisRequest = {
      requirementText,
      rawDiff,
      includeFlow: submission.includeFlow,
      includeGapReport: submission.includeGapReport,
      includePrDescription: submission.includePrDescription,
      includeVideoScript: submission.includeVideoScript,
      includeDailyUpdate: submission.includeDailyUpdate,
      ...(submission.projectName !== undefined ? { projectName: submission.projectName } : {}),
      ...(submission.sessionId !== undefined ? { sessionId: submission.sessionId } : {}),
    };

    const result = await runner.run(request);
    // Cache the full result so the side-chat edit endpoints can reuse the
    // session's artifacts without re-running analysis.
    store?.saveResult(result);
    return {
      status: 'success',
      mode,
      sessionId: result.sessionId,
      overview: {
        readiness: result.gapReport?.readiness ?? null,
        confidence: result.requirementAlignment.confidence,
      },
      inputs: { requirementText, rawDiff },
      cards: renderWorkspaceCards(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', mode, message };
  }
}
