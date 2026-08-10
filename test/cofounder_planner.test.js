const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPlanItems, inferMode, extractWorkingItems } = require("../cofounder_planner");

test("discovery plans several warm questions and a natural naming checkpoint", () => {
  const memory = {
    project: { onboarding_state: "discovery" },
    discovery_facts: [
      { field_key: "customer_segment", statement: "Independent teachers", confidence: "high", status: "current" },
      { field_key: "problem", statement: "Grading takes too long", confidence: "high", status: "current" },
      { field_key: "context", statement: "After school", confidence: "medium", status: "current" },
      { field_key: "current_workaround", statement: "They grade at night", confidence: "medium", status: "current" },
      { field_key: "solution", statement: "A feedback assistant", confidence: "medium", status: "current" }
    ]
  };
  const plan = buildPlanItems(memory, { sourceIds: ["turn-1"] });
  assert.equal(plan.mode, "synthesizer");
  assert.equal(plan.items[0].intent, "checkpoint_name_company");
  assert.ok(plan.items.length >= 2);
  assert.equal(plan.items[0].response_type, "checkpoint");
});

test("hidden personality mode responds to founder intent", () => {
  assert.equal(inferMode({ message: "I interviewed five teachers and learned they already use a spreadsheet" }), "evidence_interpreter");
  assert.equal(inferMode({ message: "Should we build the dashboard now or keep testing?" }), "constructive_challenger");
  assert.equal(inferMode({ message: "I am designing the first screen for the teacher" }), "product_design_partner");
});

test("working memory keeps aspect, confidence, and source provenance", () => {
  const items = extractWorkingItems({ projectId: "project-1", sourceTurnId: "turn-1", facts: [{ field: "buyer", statement: "A school administrator pays", classification: "inference", confidence: "medium" }] });
  assert.deepEqual(items[0], {
    project_id: "project-1", aspect: "buyer", statement: "A school administrator pays", classification: "inference", confidence: "medium", review_state: "working", source_turn_ids: ["turn-1"], related_entity_ids: { discovery_field: "buyer" }
  });
});
