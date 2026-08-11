const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const browserFiles = [app, html, fs.readFileSync(path.join(root, "styles.css"), "utf8"), fs.readFileSync(path.join(root, "overrides.css"), "utf8")].join("\n");

test("Conversation-first discovery mode is wired", () => {
  assert.match(html, /href="#chat"[^>]*data-view-link="chat"/);
  assert.match(app, /function discoveryMode\(\)/);
  assert.match(app, /function discoveryLearning\(\)/);
  assert.match(app, /data-action="complete-checkpoint"/);
  assert.match(app, /Review company snapshot/);
  assert.match(app, /checkpointConfirmForm/);
  assert.match(app, /checkpoint\/synthesis/);
  assert.match(app, /data-gated-nav/);
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
  assert.match(app, /e\.key!=="Enter" \|\| e\.shiftKey/);
  assert.match(app, /e\.target\.form\.requestSubmit\(\)/);
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

test("Checkpoint review requires red AI-organized fields and presents gaps as a side rail", () => {
  assert.match(app, /checkpoint-review-layout/);
  assert.match(app, /checkpoint-name-suggestion/);
  assert.match(app, /data-checkpoint-required/);
  assert.match(app, /multiline=new Set\(\[\"short_description\",\"problem_statement\",\"solution_summary\",\"founder_goal\",\"pricing_hypothesis\"\]\)/);
  assert.match(app, /checkpoint-submit/);
  assert.match(app, /confirm-checkpoint-field/);
  assert.match(app, /markCheckpointFieldReviewed/);
  assert.match(app, /classList\.contains\("ai-organized"\)/);
  assert.match(browserFiles, /\.checkpoint-field\.ai-organized/);
  assert.match(browserFiles, /\.checkpoint-gaps-panel/);
});

test("Company memory uses concise summaries and hides historical conversation sources", () => {
  const memorySection = app.slice(app.indexOf("function memoryWorkspace"), app.indexOf("function evidence"));
  assert.match(app, /function memoryItemSummary/);
  assert.match(memorySection, /class="memory-summary"/);
  assert.match(app, /details class="memory-sources"/);
  assert.match(app, /Show \$\{sources\.length\} historical conversation/);
  assert.doesNotMatch(memorySection, /Source \$\{esc\(\(item\.source_turn_ids/);
  assert.match(browserFiles, /\.memory-sources\[open\]/);
});
