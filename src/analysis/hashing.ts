import { createHash } from 'node:crypto';

/**
 * Stable content hash used for session metadata. It lets a future persistent
 * store recognize when an input changed; it carries no reasoning meaning.
 */
export function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
