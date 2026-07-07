/**
 * Generates the inline browser app's artifact constant tables from the shared
 * `ARTIFACT_METADATA`, so the client never re-declares product labels, groups,
 * flags, or dependencies. This is the bridge that keeps the metadata a single
 * source of truth across the server/client boundary of this no-build app.
 *
 * The output is an array of JS source lines spliced into the client `state.ts`
 * fragment. Values are emitted with single quotes and no escaping; the metadata
 * intentionally contains no apostrophes so this stays simple and safe.
 */
import { ARTIFACT_METADATA, OVERVIEW_HELP } from './artifactMetadata.js';

function q(value: string): string {
  return `'${value}'`;
}

function tuples(pairs: readonly (readonly [string, string])[]): string {
  return `[${pairs.map(([k, v]) => `[${q(k)},${q(v)}]`).join(',')}]`;
}

function objectOf(entries: readonly (readonly [string, string])[]): string {
  return `{ ${entries.map(([k, v]) => `${k}:${v}`).join(', ')} }`;
}

/** The `var BASE/OUTPUTS/GROUP_OF/FLAG_OF/DEPS/HELP/EDITABLE` lines, in order. */
export function clientArtifactConstantLines(): string[] {
  const base = ARTIFACT_METADATA.filter((m) => m.isBaseArtifact);
  const outputs = ARTIFACT_METADATA.filter((m) => m.isGeneratedOnDemand);

  const baseLine = `var BASE = ${tuples(base.map((m) => [m.key, m.label] as const))};`;
  const outputsLine = `var OUTPUTS = ${tuples(outputs.map((m) => [m.key, m.label] as const))};`;

  const groupLine = `var GROUP_OF = ${objectOf(
    ARTIFACT_METADATA.map((m) => [m.key, q(m.group)] as const),
  )};`;

  const flagLine = `var FLAG_OF = ${objectOf(
    ARTIFACT_METADATA.filter((m) => m.flag !== undefined).map((m) => [m.key, q(m.flag as string)] as const),
  )};`;

  const depsLine = `var DEPS = ${objectOf(
    ARTIFACT_METADATA.filter((m) => m.requiredDependencies !== undefined).map(
      (m) => [m.key, `[${(m.requiredDependencies as readonly string[]).map(q).join(',')}]`] as const,
    ),
  )};`;

  const helpLine = `var HELP = ${objectOf([
    ['overview', q(OVERVIEW_HELP)] as const,
    ...ARTIFACT_METADATA.map((m) => [m.key, q(m.description)] as const),
  ])};`;

  const editableLine = `var EDITABLE = ${objectOf(
    ARTIFACT_METADATA.filter((m) => m.isEditable).map(
      (m) => [m.key, q(m.chatTitle ?? m.label)] as const,
    ),
  )};`;

  return [baseLine, outputsLine, groupLine, flagLine, depsLine, helpLine, editableLine];
}
