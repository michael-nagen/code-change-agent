/**
 * Handlers for side-chat artifact editing.
 *
 * These endpoints edit ONE selected, already-generated text artifact in place.
 * They never re-run analysis, never re-fetch a diff, and never touch any other
 * artifact. They operate purely over the UI-layer session cache.
 *
 * Both handlers map every failure to a structured error response whose
 * `message` is the actual error text (shown verbatim in the UI). They never
 * throw for skill/validation/lookup failures.
 */
import type { AnalysisResult } from '../analysis/index.js';
import type {
  ArtifactEditSessionContext,
  ArtifactEditSkill,
  ChatMessage,
  EditableArtifactKey,
} from '../skills/artifactEdit/index.js';
import type { ChatEditResponse, UndoArtifactEditResponse, WorkspaceCard } from './types.js';
import {
  getEditableArtifact,
  isEditableArtifactKey,
  type UiSessionStore,
} from './sessionStore.js';
import { renderWorkspaceCards } from './features/artifactViews/index.js';

const UNSUPPORTED_MESSAGE = 'Chat editing is available for generated text artifacts only.';

export async function handleChatEdit({
  skill,
  store,
  sessionId,
  body,
}: {
  skill: ArtifactEditSkill;
  store: UiSessionStore;
  sessionId: string;
  body: unknown;
}): Promise<ChatEditResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;

  const artifactKey = fields['artifactKey'];
  if (typeof artifactKey !== 'string' || !isEditableArtifactKey(artifactKey)) {
    return { status: 'error', message: UNSUPPORTED_MESSAGE };
  }

  const message = fields['message'];
  if (typeof message !== 'string' || message.trim() === '') {
    return { status: 'error', message: 'A non-empty "message" is required.' };
  }

  const conversationHistory = parseConversationHistory(fields['conversationHistory']);
  if (conversationHistory === 'invalid') {
    return { status: 'error', message: '"conversationHistory" must be an array of chat messages.' };
  }

  const result = store.getResult(sessionId);
  if (result === undefined) {
    return { status: 'error', message: `Session not found: ${sessionId}` };
  }

  const selectedArtifact = getEditableArtifact(result, artifactKey);
  if (selectedArtifact === undefined) {
    return { status: 'error', message: UNSUPPORTED_MESSAGE };
  }

  let edit;
  try {
    edit = await skill.execute({
      selectedArtifactKey: artifactKey,
      selectedArtifact,
      userMessage: message,
      sessionContext: buildSessionContext(result),
      ...(conversationHistory !== undefined ? { conversationHistory } : {}),
    });
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }

  let updatedResult;
  try {
    updatedResult = store.applyEdit({
      sessionId,
      artifactKey,
      updatedArtifact: edit.updatedArtifact,
      changeSummary: edit.changeSummary,
    });
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }

  return {
    status: 'success',
    assistantMessage: edit.assistantMessage,
    changeSummary: edit.changeSummary,
    updatedArtifact: edit.updatedArtifact,
    card: findCard(updatedResult, artifactKey),
    canUndo: store.hasHistory(sessionId, artifactKey),
  };
}

export function handleUndoArtifactEdit({
  store,
  sessionId,
  body,
}: {
  store: UiSessionStore;
  sessionId: string;
  body: unknown;
}): UndoArtifactEditResponse {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;

  const artifactKey = fields['artifactKey'];
  if (typeof artifactKey !== 'string' || !isEditableArtifactKey(artifactKey)) {
    return { status: 'error', message: UNSUPPORTED_MESSAGE };
  }

  if (store.getResult(sessionId) === undefined) {
    return { status: 'error', message: `Session not found: ${sessionId}` };
  }

  let outcome;
  try {
    outcome = store.undoEdit(sessionId, artifactKey);
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }

  return {
    status: 'success',
    restored: outcome.restored,
    card: findCard(outcome.result, artifactKey),
    canUndo: store.hasHistory(sessionId, artifactKey),
  };
}

/** Collect the artifacts present on the result as read-only edit context (no rawDiff). */
function buildSessionContext(result: AnalysisResult): ArtifactEditSessionContext {
  const context: ArtifactEditSessionContext = {
    changeExplanation: result.changeExplanation,
    requirementAlignment: result.requirementAlignment,
  };
  if (result.gapReport !== undefined) context.gapReport = result.gapReport;
  if (result.flowArtifact !== undefined) context.flowArtifact = result.flowArtifact;
  if (result.prDescription !== undefined) context.prDescription = result.prDescription;
  if (result.videoScript !== undefined) context.videoScript = result.videoScript;
  if (result.dailyUpdate !== undefined) context.dailyUpdate = result.dailyUpdate;
  return context;
}

function findCard(result: AnalysisResult, artifactKey: EditableArtifactKey): WorkspaceCard {
  const cards = renderWorkspaceCards(result);
  const card = cards.find((c) => c.id === artifactKey);
  if (card === undefined) {
    // renderWorkspaceCards always emits a card per editable key; this is defensive.
    throw new Error(`No card rendered for artifact "${artifactKey}".`);
  }
  return card;
}

/**
 * Returns the parsed history, undefined when absent, or the sentinel 'invalid'
 * when the value is present but malformed. Unknown roles or non-string content
 * are rejected (fail closed).
 */
function parseConversationHistory(value: unknown): ChatMessage[] | undefined | 'invalid' {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return 'invalid';
  }
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return 'invalid';
    }
    const entry = item as Record<string, unknown>;
    const role = entry['role'];
    const content = entry['content'];
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return 'invalid';
    }
    messages.push({ role, content });
  }
  return messages;
}
