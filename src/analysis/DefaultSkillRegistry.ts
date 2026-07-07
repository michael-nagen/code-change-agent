import { HarnessError } from '../errors/HarnessError.js';
import type { RegisteredSkills, SkillKey, SkillRegistry } from './types/index.js';

/**
 * A small, explicit registry. Skills are stored under a loose map and cast back
 * to their declared type on resolve — the public API stays type-safe via
 * `RegisteredSkills`, while the internal store can hold heterogeneous skills.
 */
export class DefaultSkillRegistry implements SkillRegistry {
  private readonly skills = new Map<SkillKey, unknown>();

  register<K extends SkillKey>({ key, skill }: { key: K; skill: RegisteredSkills[K] }): void {
    this.skills.set(key, skill);
  }

  resolve<K extends SkillKey>(key: K): RegisteredSkills[K] {
    const skill = this.skills.get(key);
    if (skill === undefined) {
      throw new HarnessError('UNKNOWN_SKILL', `No skill registered for key "${key}".`);
    }
    return skill as RegisteredSkills[K];
  }
}
