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

test("proposal idempotency is deterministic for a persisted assistant turn and context", () => {
  assert.equal(idempotencyKey("project-1", { id: "assistant-1" }, contextPacket), idempotencyKey("project-1", { id: "assistant-1" }, contextPacket));
  assert.notEqual(idempotencyKey("project-1", { id: "assistant-2" }, contextPacket), idempotencyKey("project-1", { id: "assistant-1" }, contextPacket));
});
