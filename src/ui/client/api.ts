/**
 * Client app: the single place that knows server endpoints.
 *
 * Every browser → server call goes through this `api` object. Controllers call
 * the named methods and never embed `fetch` or endpoint URLs themselves, so
 * routes live in exactly one spot.
 *
 * `runAnalysis` (initial run) and `generateArtifact` (on-demand generation)
 * both hit `/api/analyze`; they are kept as distinct methods so call sites read
 * by intent. Each method returns a promise of the parsed JSON response,
 * preserving the original control flow (callers keep their own `.then`/`.catch`).
 */
export const API_LINES: string[] = [
  "var api = {",
  "  runAnalysis: function (payload) {",
  "    return fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  generateArtifact: function (payload) {",
  "    return fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  chatEdit: function (sessionId, payload) {",
  "    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/chat-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  undoArtifactEdit: function (sessionId, payload) {",
  "    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/undo-artifact-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  saveMemory: function (sessionId, payload) {",
  "    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/save-memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  applyDecisions: function (sessionId, payload) {",
  "    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/apply-decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  writeNotion: function (sessionId, payload) {",
  "    return fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/write-notion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  clearMemory: function (payload) {",
  "    return fetch('/api/memory/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  },",
  "  editMemory: function (payload) {",
  "    return fetch('/api/memory/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });",
  "  }",
  "};",
  "",
];
