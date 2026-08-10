const test = require("node:test");
const assert = require("node:assert/strict");
const { synthesizeCheckpoint } = require("../checkpoint_synthesis");

const fact = (field_key, statement, confidence = "high", classification = "founder_statement", id = field_key) => ({ id, field_key, statement, confidence, classification, source_turn_id: `turn-${id}`, status: "current", created_at: "2026-01-01" });

test("direct discovery facts map into a reviewable profile with provenance", () => {
  const synthesis = synthesizeCheckpoint({ project: { id: "p", name: "New project", onboarding_state: "discovery" }, discovery_facts: [
    fact("customer_segment", "Independent bookkeepers"), fact("problem", "They lose hours chasing invoices"), fact("context", "At month end"), fact("current_workaround", "Spreadsheets and email"), fact("solution", "Automated invoice follow-up")
  ] });
  assert.equal(synthesis.readiness, true);
  assert.equal(synthesis.fields.target_customer.value, "Independent bookkeepers");
  assert.equal(synthesis.fields.target_customer.status, "founder_stated");
  assert.deepEqual(synthesis.fields.target_customer.provenance.source_fact_ids, ["customer_segment"]);
  assert.match(synthesis.fields.short_description.value, /Automated invoice follow-up for Independent bookkeepers/);
});

test("inferred and low-confidence facts stay marked for review", () => {
  const synthesis = synthesizeCheckpoint({ project: { name: "New project" }, discovery_facts: [
    fact("customer_segment", "Operators", "medium", "inference"), fact("problem", "Manual work", "high"), fact("context", "Weekly", "high"), fact("current_workaround", "Spreadsheets", "high"), fact("solution", "A helper", "high")
  ] });
  assert.equal(synthesis.fields.target_customer.status, "needs_review");
  assert.equal(synthesis.fields.target_customer.confidence, "medium");
});

test("unsupported pricing and industry remain blank", () => {
  const facts = ["customer_segment", "problem", "context", "current_workaround", "solution"].map(key => fact(key, key));
  const synthesis = synthesizeCheckpoint({ project: { name: "New project" }, discovery_facts: facts });
  assert.equal(synthesis.fields.pricing_hypothesis.value, "");
  assert.equal(synthesis.fields.first_dollar_path.value, "");
  assert.equal(synthesis.fields.primary_industry.value, "");
  assert.equal(synthesis.company_name.value, "");
  assert.ok(synthesis.company_name_suggestion);
});
