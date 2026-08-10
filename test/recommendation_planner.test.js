const test = require("node:test");
const assert = require("node:assert/strict");
const { planRecommendation, rankUnresolvedIssues } = require("../recommendation_planner");

function base(overrides = {}) {
  return { project: { id: "p", target_customer: "Independent operators" }, assumptions: [{ id: "b", statement: "Second issue", status: "untested", importance: 5, uncertainty: 3, risk_score: 70 }, { id: "a", statement: "First issue", status: "untested", importance: 5, uncertainty: 3, risk_score: 70 }], evidence: [], tasks: [], experiments: [], assumption_evidence: [], ...overrides };
}

test("planner ranks every unresolved issue with stable documented tie breakers", () => {
  const first = rankUnresolvedIssues(base());
  const second = rankUnresolvedIssues(base());
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(issue => issue.assumption_id), ["a", "b"]);
  assert.deepEqual(first.map(issue => issue.rank), [1, 2]);
});

test("planner follows approved question, known-task, experiment, then relevant-wait precedence", () => {
  assert.equal(planRecommendation(base({ project: { id: "p" } })).recommendation.state, "question");
  assert.equal(planRecommendation(base({ assumptions: [{ id: "a", statement: "Defined", status: "untested", importance: 2, uncertainty: 2, risk_score: 20 }] })).recommendation.state, "task");
  assert.equal(planRecommendation(base()).recommendation.state, "experiment");
  assert.equal(planRecommendation(base({ assumptions: [{ id: "a", statement: "Moderate uncertainty", status: "untested", importance: 2, uncertainty: 3, risk_score: 50 }], tasks: [{ id: "t", assumption_id: "a", status: "doing", created_at: "2026-01-02T00:00:00Z" }] })).recommendation.state, "wait");
});

test("discovery projects ask for scope instead of waiting with no recorded issue", () => {
  const plan = planRecommendation({ project: { id: "p", onboarding_state: "discovery" }, assumptions: [], evidence: [], tasks: [], experiments: [], assumption_evidence: [] });
  assert.equal(plan.recommendation.state, "question");
  assert.equal(plan.recommendation.rule, "discovery_question");
});

test("active-work suppression is scoped to the selected issue identity, with an explicit legacy text fallback", () => {
  const issue = { id: "a", statement: "Validate recurring billing", status: "untested", importance: 3, uncertainty: 3, risk_score: 50 };
  const unrelated = planRecommendation(base({ assumptions: [issue], tasks: [{ id: "other", assumption_id: "b", status: "doing", created_at: "2026-01-02T00:00:00Z" }] }));
  assert.equal(unrelated.recommendation.state, "task");
  const legacy = planRecommendation(base({ assumptions: [issue], tasks: [{ id: "legacy", issue_text: "  validate   recurring billing ", status: "doing", created_at: "2026-01-02T00:00:00Z" }] }));
  assert.equal(legacy.recommendation.state, "wait");
  const newEvidence = planRecommendation(base({ assumptions: [issue], evidence: [{ id: "e", created_at: "2026-01-03T00:00:00Z" }], assumption_evidence: [{ assumption_id: "a", evidence_id: "e" }], tasks: [{ id: "legacy", issue_text: "Validate recurring billing", status: "doing", created_at: "2026-01-02T00:00:00Z" }] }));
  assert.equal(newEvidence.recommendation.state, "task");
});

test("active work suppresses replacement tasks and experiments across risk bands", () => {
  const lowRisk = base({
    assumptions: [{ id: "a", statement: "Known low-risk issue", status: "untested", importance: 2, uncertainty: 2, risk_score: 20 }],
    evidence: [{ id: "e", created_at: "2026-01-01T00:00:00Z" }],
    assumption_evidence: [{ assumption_id: "a", evidence_id: "e" }],
    tasks: [{ id: "t", assumption_id: "a", status: "doing", created_at: "2026-01-02T00:00:00Z" }]
  });
  assert.equal(planRecommendation(lowRisk).recommendation.rule, "active_work");
  assert.equal(planRecommendation(lowRisk).recommendation.state, "wait");

  const critical = base({
    assumptions: [{ id: "a", statement: "Critical outside-world issue", status: "untested", importance: 5, uncertainty: 5, risk_score: 90 }],
    experiments: [{ id: "x", assumption_id: "a", status: "running", started_at: "2026-01-02T00:00:00Z" }]
  });
  assert.equal(planRecommendation(critical).recommendation.rule, "active_work");
  assert.equal(planRecommendation(critical).recommendation.state, "wait");
});
