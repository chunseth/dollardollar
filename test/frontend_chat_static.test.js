const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const browserFiles = [app, html, fs.readFileSync(path.join(root, "styles.css"), "utf8"), fs.readFileSync(path.join(root, "overrides.css"), "utf8")].join("\n");

test("Phase 7 chat navigation and onboarding route are present", () => {
  assert.match(html, /href="#chat"[^>]*data-view-link="chat"/);
  assert.match(app, /const views = \{chat, cofounder: chat/);
  assert.match(app, /location\.hash="chat";loadMemory\(project\.id\)/);
  assert.match(app, /data-action="open-chat"/);
});

test("Chat loads project-scoped history, recommendations, and pending proposals", () => {
  assert.match(app, /request\(`\/api\/projects\/\$\{projectId\}\/chat`\)/);
  assert.match(app, /request\(`\/api\/projects\/\$\{projectId\}\/recommendation`\)/);
  assert.match(app, /request\(`\/api\/projects\/\$\{projectId\}\/change-sets`\)/);
  assert.match(app, /chatTurns\.map\(turn/);
  assert.match(app, /related-chip unresolved/);
});

test("Chat submission, quick capture, and proposal review use existing API endpoints", () => {
  assert.match(app, /id==="chatForm"/);
  assert.match(app, /method:"POST",body:JSON\.stringify\(\{message,client_request_id/);
  assert.match(app, /if\(result\.error\|\|result\.proposal_error\)\{state\.chatDraft=message/);
  assert.match(app, /capture-task/);
  assert.match(app, /capture-evidence/);
  assert.match(app, /capture-experiment/);
  assert.match(app, /\/approve-items/);
  assert.match(app, /\/reject/);
  assert.match(app, /data-action="apply-change-set"/);
  assert.match(app, /chatRefresh\(\)/);
});

test("Browser code does not reference OpenAI credentials or make direct OpenAI calls", () => {
  assert.doesNotMatch(browserFiles, /OPENAI_API_KEY/i);
  assert.doesNotMatch(browserFiles, /api\.openai\.com/i);
});
