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

const diff = `diff --git a/src/harness/CodeUnderstandingHarness.ts b/src/harness/CodeUnderstandingHarness.ts
--- a/src/harness/CodeUnderstandingHarness.ts
+++ b/src/harness/CodeUnderstandingHarness.ts
@@ -1,5 +1,6 @@
 import type { HarnessSkills, SessionInputs } from '../types/index.js';
+import { SessionStore } from './SessionStore.js';

 export class CodeUnderstandingHarness {
-  private state: Map<string, unknown> = new Map();
+  private store?: SessionStore;

   async start(inputs: SessionInputs): Promise<void> {
-    this.state.set('inputs', inputs);
+    this.store = new SessionStore(inputs);
   }
 }
diff --git a/src/harness/SessionStore.ts b/src/harness/SessionStore.ts
new file mode 100644
--- /dev/null
+++ b/src/harness/SessionStore.ts
@@ -0,0 +1,20 @@
+import type { SessionInputs, SessionState } from '../types/index.js';
+
+export class SessionStore {
+  private state: SessionState;
+
+  constructor(inputs: SessionInputs) {
+    this.state = { inputs, phase: 'created', outputs: {} };
+  }
+
+  get inputs(): SessionInputs {
+    return { ...this.state.inputs };
+  }
+
+  snapshot(): SessionState {
+    return structuredClone(this.state);
+  }
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
