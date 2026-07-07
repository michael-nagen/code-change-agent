/**
 * Types for the FlowGenerationSkill — a reusable runtime-flow output skill.
 *
 * Input is the ChangeExplanation artifact only. The raw diff is deliberately
 * absent: the flow must describe runtime/system behavior reframed from existing
 * findings, never re-read or re-analyze the diff and never reflect changed-file
 * order.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';

export interface FlowGenerationInput {
  changeExplanation: ChangeExplanation;
}

export interface FlowArtifact {
  /** A short title summarizing the feature flow. */
  title: string;
  /** What the flow represents, plus any confidence limitation. */
  description: string;
  /** Ordered, short runtime-step labels. */
  steps: string[];
  /** A simple, valid Mermaid `flowchart TD` rendering of the steps. */
  mermaid: string;
}
