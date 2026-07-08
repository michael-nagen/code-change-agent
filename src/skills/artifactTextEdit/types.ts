/**
 * Types for the ArtifactTextEditSkill.
 *
 * This skill revises ONE already-generated, already-RENDERED text artifact per a
 * freeform edit request ("make it shorter", "translate to Hebrew", "add risks").
 * Unlike {@link ../artifactEdit ArtifactEditSkill} — which edits a specific
 * structured artifact (prDescription/dailyUpdate/videoScript) and returns the
 * same JSON shape — this one operates on the plain text a channel already sent to
 * the user, so it can edit ANY generated artifact (Daily Work Guidance, Technical
 * Change Brief, Demo Prep, Weekly Review, an analysis summary, …) without knowing
 * its internal schema. It never re-analyzes a diff and never fabricates facts.
 */

export interface ArtifactTextEditInput {
  /** Product-facing label of the artifact, e.g. "Daily Work Guidance". */
  artifactLabel: string;
  /** The full rendered text of the artifact — the ONLY thing being edited. */
  originalText: string;
  /** The developer's edit request, e.g. "make it shorter". */
  instruction: string;
  /** Optional project label, for light context only. */
  projectLabel?: string;
}

export interface ArtifactTextEditResult {
  /** The full revised artifact text to send back. */
  text: string;
  /** A one-line summary of the edit, or "No changes made." when unchanged. */
  changeSummary: string;
}
