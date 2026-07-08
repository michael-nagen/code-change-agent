/**
 * Reply-to-edit handlers.
 *
 * `editArtifact` is the workhorse: given the artifact a user replied to and their
 * freeform instruction, it delegates the actual revision to the workflow bridge
 * (which calls the shared text-edit skill), shows progress, refreshes `/latest`,
 * and returns the updated text with action buttons + a fresh artifact ref so the
 * edited result is itself repliable. It runs no reasoning of its own.
 *
 * `editHelpHandler` backs the `/edit` command / "Edit again" button: with no
 * reply context there is nothing to edit, so it explains how the flow works.
 */
import { plainReply } from '../reply.js';
import { editResultKeyboard } from '../keyboards.js';
import type { TelegramArtifactRef, TelegramReply } from '../types.js';
import type { CommandHandler, HandlerContext } from './context.js';

const EDIT_UNAVAILABLE =
  'Editing is not configured on this deployment. Set UI_MODE=real with OPENAI_API_KEY (or run in mock mode) to enable reply-to-edit.';

export async function editArtifact(
  ctx: HandlerContext,
  ref: TelegramArtifactRef,
): Promise<TelegramReply> {
  const instruction = ctx.argsText.trim();
  if (instruction === '') {
    return plainReply(
      'Reply with an edit request, e.g. "make it shorter", "translate to Hebrew", or "add risks".',
    );
  }

  const bridge = ctx.bridge;
  if (bridge?.editArtifactText === undefined) {
    return plainReply(EDIT_UNAVAILABLE);
  }

  await ctx.progress('🔄 Applying edit…');

  const result = await bridge.editArtifactText({
    artifact: ref.artifact,
    originalText: ref.text,
    instruction,
    ...(ref.projectLabel !== undefined ? { projectName: ref.projectLabel } : {}),
  });
  if (result.status === 'error') {
    return plainReply(`Sorry, I couldn't apply that edit: ${result.message}`);
  }

  // Make `/latest` reflect the edited version (the session/save source is left
  // intact, so Save/Notion still act on the underlying analysis).
  ctx.state.update(ctx.chatId, {
    lastArtifact: ref.artifact,
    lastArtifactText: result.text,
    ...(ref.projectLabel !== undefined ? { lastArtifactProject: ref.projectLabel } : {}),
  });

  const updatedRef: TelegramArtifactRef = {
    artifact: ref.artifact,
    text: result.text,
    ...(ref.projectLabel !== undefined ? { projectLabel: ref.projectLabel } : {}),
    ...(ref.sessionId !== undefined ? { sessionId: ref.sessionId } : {}),
  };
  return {
    ...plainReply(result.text, { replyMarkup: editResultKeyboard(ref.artifact) }),
    artifact: updatedRef,
  };
}

export const editHelpHandler: CommandHandler = async () =>
  plainReply(
    [
      'To edit a result, REPLY to the bot message you want to change and describe the edit, for example:',
      '• make it shorter',
      '• translate to Hebrew',
      '• make it more professional',
      '• add risks',
      '• rewrite this as an implementation plan',
      '',
      'I keep the original artifact, apply your change, and send back an updated version you can edit again.',
    ].join('\n'),
  );
