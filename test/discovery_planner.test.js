const test = require("node:test");
const assert = require("node:assert/strict");
const { discoveryPlan, rankDiscoveryGaps } = require("../discovery_planner");

test("discovery planner prioritizes missing high-leverage fields", () => {
  const plan = discoveryPlan({ project: { onboarding_state: "discovery" }, discovery_facts: [{ field_key: "customer_segment", statement: "People who work long hours", confidence: "high", status: "current", created_at: "2026-01-01" }] });
  assert.equal(plan.next_gap.field, "current_workaround");
  assert.equal(plan.next_gap.status, "missing");
  assert.ok(plan.next_gap.score > 0);
});

test("low-confidence facts remain clarification gaps and do not unlock the checkpoint", () => {
  const facts = ["customer_segment", "problem", "context", "current_workaround", "solution"].map((field_key, index) => ({ field_key, statement: `Working ${field_key}`, confidence: index === 0 ? "high" : "low", status: "current", created_at: `2026-01-0${index + 1}` }));
  const plan = discoveryPlan({ discovery_facts: facts });
  assert.equal(plan.checkpoint_ready, false);
  assert.equal(plan.ranked_gaps.find(gap => gap.field === "problem").status, "needs_clarification");
  assert.ok(rankDiscoveryGaps({ discovery_facts: facts }).some(gap => gap.field === "problem"));
});
