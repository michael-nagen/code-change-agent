import { DefaultNotionInputAdapter } from './NotionInputAdapter.js';
import { DefaultNotionOutputAdapter } from './NotionOutputAdapter.js';
import type { NotionInputAdapter, NotionOutputAdapter, NotionPlugin } from './types.js';

/**
 * Composes the Notion input + output adapters into one bidirectional plugin.
 *
 * Adapters can be injected (for tests or a future real-API implementation);
 * otherwise the in-memory/text-based defaults are used.
 */
export function createNotionPlugin({
  input,
  output,
}: {
  input?: NotionInputAdapter;
  output?: NotionOutputAdapter;
} = {}): NotionPlugin {
  return {
    input: input ?? new DefaultNotionInputAdapter(),
    output: output ?? new DefaultNotionOutputAdapter(),
  };
}
