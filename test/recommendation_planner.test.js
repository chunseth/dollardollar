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

test("planner rules cover question, task, experiment, and wait with active-work precedence", () => {
  assert.equal(planRecommendation(base({ project: { id: "p" } })).recommendation.state, "question");
  assert.equal(planRecommendation(base({ assumptions: [{ id: "a", statement: "Defined", status: "untested", importance: 2, uncertainty: 2, risk_score: 20 }] })).recommendation.state, "task");
  assert.equal(planRecommendation(base()).recommendation.state, "experiment");
  assert.equal(planRecommendation(base({ tasks: [{ id: "t", assumption_id: "a", status: "doing" }] })).recommendation.state, "wait");
});
