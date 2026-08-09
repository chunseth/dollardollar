const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProjectContext, topUnresolvedIssue } = require("../context");

const timestamp = day => `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`;
function memory() {
  return {
    project: { id: "project-1", name: "Paid pilots", stage: "idea", target_customer: "Bookkeepers", first_dollar_path: { offer: "Paid pilot", price: "$200" }, updated_at: timestamp(1) },
    assumptions: [
      { id: "a-low", statement: "Low risk", status: "untested", importance: 2, uncertainty: 2, risk_score: 30, created_at: timestamp(3) },
      { id: "a-top", statement: "Customers will pay", category: "willingness_to_pay", status: "untested", importance: 5, uncertainty: 5, risk_score: 90, revenue_blocker: true, created_at: timestamp(2) },
      { id: "a-mid", statement: "They have this problem", status: "testing", importance: 4, uncertainty: 3, risk_score: 70, created_at: timestamp(4) }
    ],
    evidence: [
      { id: "e-old", source_type: "interview", source_title: "Old", summary: "Opinion", strength: "weak", specificity: "low", recency: "old", bias_risk: "high", behavior_vs_opinion: "opinion", created_at: timestamp(2) },
      { id: "e-new", source_type: "payment", source_title: "New", summary: "Paid", strength: "strong", specificity: "high", recency: "recent", bias_risk: "low", behavior_vs_opinion: "behavior", created_at: timestamp(6) }
    ],
    assumption_evidence: [{ id: "link-1", assumption_id: "a-mid", evidence_id: "e-new" }],
    experiments: [
      { id: "x-proposed", assumption_id: "a-low", title: "Proposed", hypothesis: "h", success_metric: "m", status: "proposed", created_at: timestamp(4) },
      { id: "x-done", assumption_id: "a-top", title: "Done", hypothesis: "h", success_metric: "m", status: "completed", created_at: timestamp(6) }
    ],
    tasks: [
      { id: "t-open", assumption_id: "a-low", title: "Open", status: "todo", created_at: timestamp(5) },
      { id: "t-blocked", assumption_id: "a-mid", title: "Blocked", status: "blocked", created_at: timestamp(6) },
      { id: "t-done", assumption_id: "a-top", title: "Done", status: "done", created_at: timestamp(7) }
    ],
    decisions: [{ id: "d-old", title: "Old", decision: "old", created_at: timestamp(2) }, { id: "d-new", title: "New", decision: "new", created_at: timestamp(7) }],
    latest_recommendation: { id: "r-1", recommendation: { state: "question" }, created_at: timestamp(7) },
    conversation_turns: [{ id: "c-2", turn_no: 2, actor_type: "ai", content: "new", created_at: timestamp(7) }, { id: "c-1", turn_no: 1, actor_type: "founder", content: "old", created_at: timestamp(2) }]
  };
}

test("buildProjectContext creates compact deterministic Phase 2-compatible data and source ids", () => {
  const packet = buildProjectContext(memory());
  assert.deepEqual(packet.data.project_snapshot, { id: "project-1", name: "Paid pilots", stage: "idea", target_customer: "Bookkeepers" });
  assert.deepEqual(packet.data.first_dollar_path, { offer: "Paid pilot", price: "$200" });
  assert.deepEqual(packet.data.top_assumptions.map(item => item.id), ["a-top", "a-mid", "a-low"]);
  assert.deepEqual(packet.data.recent_evidence.map(item => item.id), ["e-new", "e-old"]);
  assert.deepEqual(packet.data.active_or_proposed_experiments.map(item => item.id), ["x-proposed"]);
  assert.deepEqual(packet.data.open_tasks.map(item => item.id), ["t-blocked", "t-open"]);
  assert.deepEqual(packet.data.latest_decisions.map(item => item.id), ["d-new", "d-old"]);
  assert.deepEqual(packet.data.recent_conversation_turns.map(item => item.id), ["c-1", "c-2"]);
  assert.deepEqual(packet.included_memory_record_ids, { project: ["project-1"], assumptions: ["a-top", "a-mid", "a-low"], evidence: ["e-new", "e-old"], experiments: ["x-proposed"], tasks: ["t-blocked", "t-open"], decisions: ["d-new", "d-old"], conversation_turns: ["c-1", "c-2"], recommendations: ["r-1"] });
  assert.deepEqual(packet.data.memory_record_ids, packet.included_memory_record_ids);
  assert.deepEqual(buildProjectContext(memory()), packet);
});

test("top unresolved issue is stable, explained, and suppresses duplicate active work", () => {
  const input = memory();
  const issue = topUnresolvedIssue(input);
  assert.equal(issue.assumption_id, "a-top");
  assert.equal(issue.score, topUnresolvedIssue(input).score);
  assert.equal(issue.breakdown.linked_evidence_count, 0);
  assert.ok(issue.breakdown.revenue_proximity > 0);
  const withActiveWork = memory();
  withActiveWork.tasks.push({ id: "t-top", assumption_id: "a-top", title: "Ask", status: "doing", created_at: timestamp(8) });
  withActiveWork.experiments.push({ id: "x-top", assumption_id: "a-top", title: "Run", hypothesis: "h", success_metric: "m", status: "running", created_at: timestamp(8) });
  const suppressed = topUnresolvedIssue(withActiveWork);
  assert.equal(suppressed.breakdown.active_work_suppression, -26);
  assert.ok(suppressed.score < issue.score);
});

test("revenue proximity recognizes display-style assumption categories", () => {
  const input = memory();
  input.assumptions = [{ id: "a-display", statement: "Customers will pay", category: "Willingness to pay", status: "untested", importance: 3, uncertainty: 3, risk_score: 50 }];
  input.assumption_evidence = [];
  const issue = topUnresolvedIssue(input);
  assert.equal(issue.assumption_id, "a-display");
  assert.equal(issue.breakdown.revenue_proximity, 12);
});
