/**
 * End-to-end example using the mock skills.
 *
 * Run with: npm run example
 *
 * Demonstrates: create harness -> start session -> build understanding ->
 * generate report -> inspect state.
 */
import { CodeUnderstandingHarness } from '../src/index.js';

const requirement = `As a user, I want a "Mark all as read" button on the
notifications page so I can clear my unread count in one click.`;

const diff = `diff --git a/src/notifications/NotificationList.tsx b/src/notifications/NotificationList.tsx
@@
+  const markAllRead = () => dispatch(markAllNotificationsRead());
+  <button onClick={markAllRead}>Mark all as read</button>
diff --git a/src/store/notifications.ts b/src/store/notifications.ts
@@
+export const markAllNotificationsRead = createAction('notifications/markAllRead');`;

async function main(): Promise<void> {
  // 1. Create harness (defaults to mock skills).
  const harness = new CodeUnderstandingHarness();

  // 2. Start session.
  await harness.start({ requirement, diff });
  console.log('Phase after start:', harness.getState().phase);

  // 3. Build understanding (Understanding Memory).
  const understanding = await harness.buildUnderstanding();
  console.log('\nUnderstanding:', JSON.stringify(understanding, null, 2));

  // 4. Generate report (Output Memory).
  const report = await harness.generateReport();
  console.log('\nReport:\n' + report);

  // Recomputation avoidance: second call returns cached value (no re-run).
  const reportAgain = await harness.generateReport();
  console.log('\nReport is cached (same reference value):', report === reportAgain);

  // 5. Inspect full session state.
  console.log('\nFinal state:', JSON.stringify(harness.getState(), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
