const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCofounderOutput, callCofounderModel, idempotencyKey } = require("../cofounder");

const contextPacket = { id: "context-1" };
const founderTurn = { id: "turn-1" };
const output = (state, records = []) => ({
  assistant_message: "Thanks — here is the next focused step.",
  proposed_belief_updates: [], proposed_records: records,
  recommendation: { state, primary_issue: "Payment evidence is incomplete", reason: "The result needs one more validation step.", action_payload: {}, confidence: 0.6, source_ids: ["context-1", "turn-1"] },
  needs_founder_review: true
});

test("Phase 6 normalizes the four MVP founder-message flows through the Phase 1 contract", () => {
  const flows = [
    output("question"),
    output("task", [{ type: "task", payload: { title: "Record the completed outreach" }, source_ids: ["turn-1"] }]),
    output("experiment", [{ type: "experiment", payload: { title: "Review pilot result", hypothesis: "A paid pilot is viable", success_metric: "Deposits" }, source_ids: ["turn-1"] }]),
    output("wait", [{ type: "evidence", payload: { source_type: "founder_report", source_title: "Prospect feedback", summary: "Three prospects described the same problem." }, source_ids: ["turn-1"] }])
  ];
  for (const flow of flows) {
    const normalized = normalizeCofounderOutput(flow, contextPacket, founderTurn);
    assert.equal(typeof normalized.assistant_message, "string");
    assert.equal(typeof normalized.recommendation.state, "string");
    assert.equal(typeof normalized.recommendation.primary_issue, "string");
    assert.equal(normalized.needs_founder_review, true);
  }
});

test("local default model is valid and never needs a live dependency", async () => {
  const output = await callCofounderModel({ contextPacket, founderTurn });
  assert.equal(normalizeCofounderOutput(output, contextPacket, founderTurn).recommendation.state, "question");
});

test("a valid model response cannot change deterministic priority or state", () => {
  const deterministic = { state: "wait", primary_issue: "Active outreach", reason: "Wait for the active task.", action_payload: { rule: "active_work" }, confidence: 1, source_ids: ["task:t-1"], rule: "active_work" };
  const normalized = normalizeCofounderOutput(output("experiment"), { id: "context-1", data: { deterministic_recommendation: deterministic } }, founderTurn);
  assert.equal(normalized.recommendation.state, "wait");
  assert.equal(normalized.recommendation.primary_issue, "Active outreach");
  assert.equal(normalized.recommendation.reason, "The result needs one more validation step.");
});

test("invalid deterministic recommendation context is rejected before model wording is shaped", () => {
  const invalid = { state: "task", primary_issue: "Payment evidence", reason: "Do the work.", action_payload: {}, confidence: 1, source_ids: ["a"] };
  assert.throws(() => normalizeCofounderOutput(output("task"), { id: "context-1", data: { deterministic_recommendation: invalid } }, founderTurn), /Deterministic recommendation context requires rule/);
});

test("proposal idempotency is deterministic for the same proposal retry, not a newly-created assistant turn", () => {
  const proposal = output("task", [{ type: "task", payload: { title: "Ask five founders" }, source_ids: ["turn-1"] }]);
  assert.equal(idempotencyKey("project-1", proposal, contextPacket, founderTurn), idempotencyKey("project-1", proposal, contextPacket, founderTurn));
  assert.equal(idempotencyKey("project-1", proposal, { id: "context-2" }, { id: "turn-2" }, "retry-1"), idempotencyKey("project-1", proposal, contextPacket, founderTurn, "retry-1"));
  assert.notEqual(idempotencyKey("project-1", { ...proposal, assistant_message: "Different proposal" }, contextPacket, founderTurn), idempotencyKey("project-1", proposal, contextPacket, founderTurn));
});
