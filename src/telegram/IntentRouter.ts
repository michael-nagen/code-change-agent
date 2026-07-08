/**
 * Routes a free-text (non-slash) message to the SAME command the user could have
 * typed, so plain messages flow through the identical dispatch path as commands.
 *
 * Primary path: the LLM-backed {@link WorkRequestIntentSkill} classifies the
 * message and extracts any explicitly-stated project/spec/diff. When no skill is
 * configured (e.g. mock mode) or the skill errors/returns `unknown`, a small
 * deterministic keyword heuristic is used so the bot still responds sensibly.
 *
 * This layer holds NO reasoning of its own beyond that fallback — the semantic
 * understanding lives in the skill; here we only translate an action into a
 * command line the dispatcher already knows.
 */
import type {
  WorkRequestAction,
  WorkRequestIntent,
  WorkRequestIntentSkill,
} from '../skills/workRequestIntent/index.js';

/** A command line equivalent to what the user could have typed. */
export interface RoutedCommand {
  command: string;
  argsText: string;
}

export interface IntentRouter {
  /** Route a message to a command, or undefined when nothing sensible matches. */
  route(message: string): Promise<RoutedCommand | undefined>;
}

export class DefaultIntentRouter implements IntentRouter {
  constructor(private readonly skill?: WorkRequestIntentSkill) {}

  async route(message: string): Promise<RoutedCommand | undefined> {
    const text = message.trim();
    if (text === '') return undefined;

    if (this.skill !== undefined) {
      try {
        const intent = await this.skill.execute({ message: text });
        if (intent.action !== 'unknown') return fromIntent(intent);
      } catch {
        // Fall through to the heuristic — a classifier failure must not 500.
      }
    }
    return heuristic(text);
  }
}

/** Turn a classified intent into a concrete command line. */
function fromIntent(intent: WorkRequestIntent): RoutedCommand {
  if (intent.action === 'analyze') {
    return { command: 'analyze', argsText: buildAnalyzeArgs(intent) };
  }
  if (intent.action === 'save') {
    return { command: 'save', argsText: intent.saveSource ?? '' };
  }
  return { command: intent.action, argsText: intent.projectName ?? '' };
}

/** Reconstruct the `<project> spec: … diff: …` form the analyze parser expects. */
function buildAnalyzeArgs(intent: WorkRequestIntent): string {
  const parts: string[] = [];
  if (intent.projectName !== undefined) parts.push(intent.projectName);
  if (intent.spec !== undefined) parts.push(`spec: ${intent.spec}`);
  if (intent.diff !== undefined) parts.push(`diff: ${intent.diff}`);
  return parts.join(' ');
}

/** Deterministic keyword fallback. Order matters: earlier matches win. */
function heuristic(message: string): RoutedCommand | undefined {
  const text = message.toLowerCase();
  const rules: { test: RegExp; action: WorkRequestAction }[] = [
    { test: /\bhelp\b|what can you|how do i/, action: 'help' },
    { test: /\bprojects?\b.*\b(list|all|which)|list.*projects?/, action: 'projects' },
    { test: /\bpreferences?\b/, action: 'preferences' },
    { test: /\banaly[sz]e|review (the|this) change|run analysis/, action: 'analyze' },
    { test: /\btechnical|change brief\b/, action: 'technical' },
    { test: /\bdemo|presentation|slides?\b/, action: 'demo' },
    { test: /\bweekly|this week|the week\b/, action: 'weekly' },
    { test: /\bdaily|today|next step|what.*(do|work on) next/, action: 'daily' },
    { test: /\bsummary|summari[sz]e/, action: 'summary' },
    { test: /\blatest|last (run|artifact|result)/, action: 'latest' },
    { test: /\bmemory\b/, action: 'memory' },
    { test: /\bclear|forget|reset\b/, action: 'clear' },
    { test: /\bsave\b/, action: 'save' },
    { test: /\bstatus|progress|blocker|where are we|how.*going/, action: 'status' },
  ];
  for (const rule of rules) {
    if (rule.test.test(text)) return { command: rule.action, argsText: '' };
  }
  return undefined;
}
