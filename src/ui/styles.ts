/**
 * The Analysis Workspace stylesheet, as a single CSS string injected into the
 * page <head>. Kept separate from markup and behavior so `page.ts` stays a thin
 * composition file.
 */
export const STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; line-height: 1.55; color: #1f2430;
  background: linear-gradient(180deg, #eef2fb 0%, #f5f6f8 220px, #f5f6f8 100%); min-height: 100vh; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 28px 24px 72px; }
.app-header { margin-bottom: 18px; }
.app-header h1 { font-size: 25px; margin: 0 0 6px; letter-spacing: -0.01em; }
.app-header p { margin: 0; color: #5b6473; font-size: 15px; max-width: 760px; }
.app-tagline { color: #3a4151 !important; font-size: 15px; margin: 0 0 4px !important; max-width: 820px; }
.app-subtle { font-size: 12.5px !important; max-width: 820px; }
.companion-status { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.companion-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 999px; background: #fff; border: 1px solid #e6e9ef; color: #5b6473; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.companion-chip b { color: #1f2430; font-weight: 700; }
.companion-chip-mock { background: #fff4d6; border-color: #f0d68a; color: #7a5a0f; }
.companion-chip-real { background: #e2f6ea; border-color: #b6e6c8; color: #137a45; }
.companion-chip-memory { background: #eef4ff; border-color: #d4e2ff; color: #1c4fd1; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #8a93a3; margin: 24px 0 10px; }
h3 { font-size: 15px; margin: 0; color: #1f2430; }
h4 { font-size: 13px; margin: 14px 0 4px; color: #3a4151; }
h5 { font-size: 13px; margin: 8px 0 2px; color: #3a4151; }
.banner { padding: 10px 14px; border-radius: 10px; font-weight: 600; font-size: 13px; margin-bottom: 18px; }
.banner-mock { background: #fff4d6; color: #7a5a0f; border: 1px solid #f0d68a; }
.banner-real { background: #e2f6ea; color: #137a45; border: 1px solid #b6e6c8; }
.card { background: #ffffff; border: 1px solid #e6e9ef; border-radius: 14px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.05); }
label { display: block; font-size: 13px; font-weight: 600; color: #3a4151; margin-bottom: 6px; }
input[type=text], textarea, select { width: 100%; background: #fbfcfd; color: #1f2430; border: 1px solid #d7dce4; border-radius: 10px; padding: 11px 12px; font-size: 14px; font-family: inherit; }
input:focus, textarea:focus, select:focus { outline: none; border-color: #4c8dff; box-shadow: 0 0 0 3px rgba(76,141,255,.18); }
textarea { resize: vertical; }
textarea.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.mode-desc { margin: 10px 0 16px; color: #5b6473; font-size: 13px; }
.field-group { margin-top: 4px; }
.note { background: #eef4ff; color: #2c5bb0; border: 1px solid #cfe0ff; border-radius: 10px; padding: 9px 12px; font-size: 12.5px; margin: 0 0 14px; }
.primary-btn { cursor: pointer; border-radius: 10px; border: none; background: #2f6df6; color: #fff; padding: 13px 22px; font-size: 15px; font-weight: 700; box-shadow: 0 1px 2px rgba(47,109,246,.35); }
.primary-btn:hover { background: #245ad6; }
.primary-btn:disabled { opacity: .6; cursor: not-allowed; }
.btn { cursor: pointer; border-radius: 8px; border: 1px solid #d7dce4; background: #f6f8fb; color: #2c3340; padding: 7px 13px; font-size: 12.5px; font-weight: 600; }
.btn:hover { background: #eef1f6; }
.btn-accent { background: #2f6df6; border-color: #2f6df6; color: #fff; }
.btn-accent:hover { background: #245ad6; }
.btn-soft { background: #eaf1ff; border-color: #cfe0ff; color: #245ad6; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.status { padding: 12px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 600; }
.status-idle { background: #eef1f6; color: #5b6473; }
.status-loading { background: #eaf1ff; color: #245ad6; }
.status-success { background: #e2f6ea; color: #137a45; }
.status-error { background: #fdeaec; color: #b42332; }
.muted { color: #7a8494; font-size: 13px; }
.code { background: #f6f8fb; border: 1px solid #e6e9ef; border-radius: 10px; padding: 12px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; color: #2c3340; }
ul { margin: 4px 0; padding-left: 20px; }
li { margin: 3px 0; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge-ready { background: #e2f6ea; color: #137a45; }
.badge-needs_changes { background: #fff4d6; color: #7a5a0f; }
.badge-blocked { background: #fdeaec; color: #b42332; }
.badge-unclear { background: #eef1f6; color: #5b6473; }
.status-tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: #eef1f6; color: #3a4151; }
.status-tag-pending { background: #fff4d6; color: #7a5a0f; }
.status-tag-approved { background: #e2f6ea; color: #137a45; }
.status-tag-rejected { background: #fdeaec; color: #b42332; }
.status-tag-edited { background: #e3edfb; color: #1d4f9c; }
.status-tag-deferred { background: #eef1f6; color: #5b6473; }
.decision-controls { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.decision-controls select, .decision-controls input { font-size: 12.5px; padding: 4px 8px; }
.decision-controls input { flex: 1; min-width: 160px; }
/* master/detail */
.layout { display: grid; grid-template-columns: 240px 1fr 340px; gap: 18px; align-items: start; }
.nav { background: #fff; border: 1px solid #e6e9ef; border-radius: 14px; padding: 12px; position: sticky; top: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.05); }
.nav-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #9aa3b2; margin: 12px 8px 6px; }
.nav-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; text-align: left; border: 1px solid transparent; background: transparent; border-radius: 9px; padding: 9px 10px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: #2c3340; }
.nav-item:hover { background: #f4f7fc; }
.nav-item.active { background: #eef4ff; border-color: #d4e2ff; color: #1c4fd1; }
.nav-item.group-understanding.active { background: #eef4ff; border-color: #d4e2ff; }
.nav-item.group-actions.active { background: #eafaf0; border-color: #c3ebd2; color: #137a45; }
.chip { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
.chip-generated { background: #e2f6ea; color: #137a45; }
.chip-not_generated { background: #eef1f6; color: #7a8494; }
.chip-generating { background: #eaf1ff; color: #245ad6; }
.chip-error { background: #fdeaec; color: #b42332; }
.panel { background: #fff; border: 1px solid #e6e9ef; border-radius: 14px; padding: 24px; min-height: 460px; box-shadow: 0 1px 3px rgba(16,24,40,.05); }
.panel-accent-understanding { border-top: 3px solid #4c8dff; }
.panel-accent-actions { border-top: 3px solid #18a558; }
.panel-accent-overview { border-top: 3px solid #7a5af5; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.panel-title { font-size: 19px; margin: 0 0 4px; letter-spacing: -0.01em; }
.panel-desc { color: #5b6473; font-size: 13.5px; margin: 0 0 16px; }
.panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.panel-body { font-size: 14px; }
.artifact-section { margin-bottom: 10px; }
.empty-state { text-align: center; color: #5b6473; padding: 40px 16px; }
.empty-state .big { font-size: 15px; font-weight: 600; color: #3a4151; margin-bottom: 8px; }
.placeholder { text-align: center; color: #8a93a3; padding: 28px 12px; font-size: 14px; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
.tile { border: 1px solid #e6e9ef; border-radius: 12px; padding: 14px; background: #fbfcfe; }
.tile-warn { background: #fff8ec; border-color: #f3e0b8; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 6px 0 18px; }
.stat { border: 1px solid #e6e9ef; border-radius: 12px; padding: 13px 14px; background: #fbfcfe; }
.stat-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #8a93a3; margin-bottom: 7px; font-weight: 700; }
.stat-value { font-size: 17px; font-weight: 700; color: #1f2430; line-height: 1.3; }
.stat-value .badge, .stat-value .status-tag { font-size: 12px; vertical-align: middle; }
.stat-note { color: #7a8494; font-size: 12px; margin-top: 4px; }
.flow-strip { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 2px 0 18px; font-size: 12px; }
.flow-step { padding: 4px 10px; border-radius: 999px; background: #f4f7fc; border: 1px solid #e6e9ef; color: #5b6473; }
.flow-step.active { background: #eef4ff; border-color: #d4e2ff; color: #1c4fd1; font-weight: 700; }
.flow-arrow { color: #c2cad6; font-weight: 700; }
.cta-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 18px; }
.trust-note { display: flex; gap: 9px; padding: 9px 0; border-bottom: 1px solid #f0f2f6; font-size: 13px; color: #3a4151; }
.trust-note:last-child { border-bottom: none; }
.trust-ico { color: #137a45; font-weight: 800; flex: none; }
.source-item { border: 1px solid #e6e9ef; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; background: #fbfcfe; }
.source-item h4 { margin: 0 0 4px; }
.replan-banner { background: #eef4ff; border: 1px solid #d4e2ff; border-radius: 10px; padding: 10px 12px; margin: 8px 0; color: #1c3f9e; font-size: 13px; }
.replan-banner .muted { margin-top: 4px; color: #4a5a8a; }
/* project command center */
.cc-card { border-color: #d4e2ff; background: linear-gradient(180deg, #f6f9ff 0%, #ffffff 120px); }
.cc-eyebrow { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: #2f6df6; font-weight: 700; margin-bottom: 6px; }
.cc-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cc-title-row h2 { font-size: 20px; text-transform: none; letter-spacing: -0.01em; color: #1f2430; margin: 0; }
.cc-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.cc-using-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #8a93a3; font-weight: 700; margin: 14px 0 6px; }
.cc-using { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.cc-using-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid #e6e9ef; color: #5b6473; }
.cc-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.cc-dot-on { background: #17a45c; }
.cc-dot-off { background: #c2cad6; }
.cc-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 4px 0 12px; }
.cc-setup-list { margin: 8px 0 14px; color: #3a4151; }
.advanced-input { margin-bottom: 16px; }
.advanced-input > summary { cursor: pointer; list-style: none; font-size: 13px; font-weight: 600; color: #5b6473; padding: 12px 16px; background: #fff; border: 1px dashed #d7dce4; border-radius: 12px; }
.advanced-input > summary:hover { color: #2c3340; border-color: #b9c1cf; }
.advanced-input > summary::-webkit-details-marker { display: none; }
.advanced-input[open] > summary { margin-bottom: 4px; border-style: solid; }
.input-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.input-actions > div { margin-top: 0 !important; }
.source-preview { background: #f6f8fb; border: 1px solid #e6e9ef; border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 11.5px; white-space: pre-wrap; word-break: break-word; max-height: 160px; overflow: auto; color: #2c3340; margin-top: 6px; }
.debug-row { margin-top: 12px; display: flex; align-items: center; gap: 8px; }
.hidden { display: none; }
/* side chat */
.chat { background: #fff; border: 1px solid #e6e9ef; border-radius: 14px; padding: 16px; position: sticky; top: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.05); display: flex; flex-direction: column; border-top: 3px solid #7a5af5; }
.chat-title { font-size: 15px; margin: 0 0 4px; color: #1f2430; }
.chat-help { margin: 0 0 12px; }
.chat-messages { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; max-height: 380px; overflow-y: auto; }
.chat-empty { color: #8a93a3; font-size: 13px; padding: 8px 0 14px; }
.chat-msg { display: flex; }
.chat-user { justify-content: flex-end; }
.chat-assistant { justify-content: flex-start; }
.chat-bubble { padding: 8px 11px; border-radius: 12px; font-size: 13px; line-height: 1.45; max-width: 88%; white-space: pre-wrap; word-break: break-word; }
.chat-user .chat-bubble { background: #2f6df6; color: #fff; border-bottom-right-radius: 4px; }
.chat-assistant .chat-bubble { background: #f1f4f9; color: #2c3340; border-bottom-left-radius: 4px; }
.chat-input { margin-bottom: 8px; }
.chat-actions { display: flex; gap: 8px; }
@media (max-width: 1080px) { .layout { grid-template-columns: 1fr; } .nav, .chat { position: static; } .tiles { grid-template-columns: 1fr; } }
`;
