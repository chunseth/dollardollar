const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCofounderOutput } = require("../ai_cofounder_contract");

function validOutput() {
  return {
    assistant_message: "Ask the first five prospects for a paid pilot.",
    proposed_belief_updates: [{ statement: "Independent bookkeepers may pay for a pilot.", classification: "hypothesis", source_ids: ["turn-1"], evidence_links: [{ source_id: "turn-1", relationship: "supports" }] }],
    proposed_records: [{ type: "task", payload: { title: "Send pilot asks" }, source_ids: ["turn-1"] }],
    recommendation: { state: "task", primary_issue: "No payment evidence", reason: "A paid ask tests willingness to pay.", action_payload: { title: "Send five pilot asks" }, confidence: 0.6, source_ids: ["turn-1"] },
    needs_founder_review: true
  };
}

test("cofounder contract accepts a valid structured proposal", () => {
  const output = validOutput();
  assert.equal(validateCofounderOutput(output), output);
});

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

test("cofounder contract rejects evidence links with missing or blank source_id", () => {
  for (const source_id of [undefined, "   "]) {
    const output = validOutput();
    if (source_id === undefined) delete output.proposed_belief_updates[0].evidence_links[0].source_id;
    else output.proposed_belief_updates[0].evidence_links[0].source_id = source_id;
    assert.throws(() => validateCofounderOutput(output), /Evidence links require a source_id/);
  }
});

test("cofounder contract rejects an unsupported record type", () => {
  const output = validOutput();
  output.proposed_records[0].type = "conversation";
  assert.throws(() => validateCofounderOutput(output), /Unsupported record type/);
});
