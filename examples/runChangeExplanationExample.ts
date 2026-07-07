/**
 * Standalone example for the ChangeExplanationSkill.
 *
 * Run with: npm run example:change-explanation
 *
 * Demonstrates: create skill with a MockLanguageModel → execute with a diff →
 * print the structured ChangeExplanation knowledge object.
 *
 * The skill is completely standalone — no Harness, no git operations, no
 * requirement input. Just diff → ChangeExplanation.
 */
import {
  DefaultChangeExplanationSkill,
  MockLanguageModel,
} from '../src/index.js';

const diff = `diff --git a/src/cache/TtlCache.ts b/src/cache/TtlCache.ts
--- a/src/cache/TtlCache.ts
+++ b/src/cache/TtlCache.ts
@@ -1,8 +1,12 @@
 export class TtlCache<T> {
-  private store = new Map<string, T>();
+  private store = new Map<string, { value: T; expiresAt: number }>();

-  get(key: string): T | undefined {
-    return this.store.get(key);
+  get(key: string): T | undefined {
+    const entry = this.store.get(key);
+    if (entry === undefined) return undefined;
+    if (entry.expiresAt <= Date.now()) {
+      this.store.delete(key);
+      return undefined;
+    }
+    return entry.value;
   }
 }
diff --git a/src/cache/ttl.ts b/src/cache/ttl.ts
new file mode 100644
--- /dev/null
+++ b/src/cache/ttl.ts
@@ -0,0 +1,6 @@
+export function withTtl<T>(value: T, ttlMs: number): { value: T; expiresAt: number } {
+  return { value, expiresAt: Date.now() + ttlMs };
+}`;

async function main(): Promise<void> {
  const model = new MockLanguageModel();
  const skill = new DefaultChangeExplanationSkill(model);

  console.log('Skill:', skill.name);
  console.log('Model:', model.name);
  console.log();

  const explanation = await skill.execute({ diff });

  console.log('=== Change Story ===');
  console.log(explanation.changeStory);

  console.log('\n=== Key Functionalities ===');
  for (const f of explanation.keyFunctionalities) {
    console.log(' -', f);
  }

  console.log('\n=== Flow ===');
  for (const step of explanation.flow) {
    console.log(' ↓', step);
  }

  console.log('\n=== Main Components ===');
  for (const c of explanation.mainComponents) {
    console.log(` ${c.name}`);
    console.log(`   ${c.responsibility}`);
  }

  console.log('\n=== Architectural Decisions ===');
  for (const d of explanation.architecturalDecisions) {
    console.log(' -', d);
  }

  console.log('\n=== Impact Analysis ===');
  for (const item of explanation.impactAnalysis) {
    console.log(' -', item);
  }

  console.log('\n=== Uncertainties ===');
  for (const u of explanation.uncertainties) {
    console.log(' ?', u);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
