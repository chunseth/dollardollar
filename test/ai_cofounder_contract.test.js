const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCofounderOutput } = require("../ai_cofounder_contract");

function validOutput() {
  return {
    assistant_message: "Ask the first five prospects for a paid pilot.",
    proposed_belief_updates: [{ statement: "Independent bookkeepers may pay for a pilot.", classification: "hypothesis", source_ids: ["turn-1"] }],
    proposed_records: [{ type: "task", payload: { title: "Send pilot asks" }, source_ids: ["turn-1"] }],
    recommendation: { state: "task", primary_issue: "No payment evidence", reason: "A paid ask tests willingness to pay.", action_payload: { title: "Send five pilot asks" }, confidence: 0.6, source_ids: ["turn-1"] },
    needs_founder_review: true
  };
}

test("cofounder contract rejects an invalid next state", () => {
  const output = validOutput();
  output.recommendation.state = "research";
  assert.throws(() => validateCofounderOutput(output), /Unsupported next state/);
});

test("cofounder contract rejects missing provenance", () => {
  const output = validOutput();
  output.proposed_belief_updates[0].source_ids = [];
  assert.throws(() => validateCofounderOutput(output), /provenance/);
});

test("cofounder contract rejects an unsupported record type", () => {
  const output = validOutput();
  output.proposed_records[0].type = "conversation";
  assert.throws(() => validateCofounderOutput(output), /Unsupported record type/);
});
