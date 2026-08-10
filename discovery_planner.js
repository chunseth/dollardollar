"use strict";

// Pre-snapshot discovery policy. This is intentionally separate from the
// recommendation planner: it ranks what the founder still needs to explain,
// not what the company should do in the market.
const discoveryFields = Object.freeze([
  { key: "customer_segment", label: "Specific customer", importance: 25, revenue: 18, dependency: 18, question: "Who is the first specific customer you want to understand?" },
  { key: "problem", label: "Concrete problem", importance: 25, revenue: 20, dependency: 20, question: "What happens for them when this problem shows up?" },
  { key: "context", label: "Problem context", importance: 15, revenue: 12, dependency: 14, question: "When and where does this problem happen most often?" },
  { key: "current_workaround", label: "Current workaround", importance: 24, revenue: 24, dependency: 18, question: "What do they do today instead?" },
  { key: "desired_outcome", label: "Desired outcome", importance: 15, revenue: 18, dependency: 12, question: "What would a meaningfully better outcome look like for them?" },
  { key: "solution", label: "Proposed solution", importance: 12, revenue: 10, dependency: 8, question: "What is the smallest version of the solution you have in mind?" },
  { key: "buyer", label: "Likely buyer", importance: 18, revenue: 25, dependency: 10, question: "Who would actually pay for this outcome?" },
  { key: "first_dollar_offer", label: "First-dollar offer", importance: 20, revenue: 30, dependency: 8, question: "What is the smallest paid offer you could make to test this?" }
]);

const fieldMap = new Map(discoveryFields.map(field => [field.key, field]));
const confidenceWeight = { high: 0, medium: 10, low: 22 };
const requiredCoreFields = ["customer_segment", "problem", "context", "current_workaround", "solution"];

function normalize(value) { return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""; }
function currentFacts(memory = {}) {
  const facts = new Map();
  for (const fact of memory.discovery_facts || []) {
    if (!fieldMap.has(fact.field_key) || fact.status === "superseded" || !normalize(fact.statement)) continue;
    const prior = facts.get(fact.field_key);
    if (!prior || new Date(fact.created_at || 0) > new Date(prior.created_at || 0)) facts.set(fact.field_key, fact);
  }
  return facts;
}

function rankDiscoveryGaps(memory = {}) {
  const facts = currentFacts(memory);
  return discoveryFields.map(field => {
    const fact = facts.get(field.key) || null;
    const confidence = fact?.confidence || "low";
    const score = fact ? confidenceWeight[confidence] : 45;
    return {
      field: field.key,
      label: field.label,
      status: fact ? (confidence === "high" ? "captured" : "needs_clarification") : "missing",
      score: score + field.importance + field.revenue + field.dependency,
      confidence,
      statement: fact?.statement || null,
      question: field.question,
      priority_factors: { importance: field.importance, revenue_proximity: field.revenue, dependency: field.dependency, uncertainty: score }
    };
  }).sort((a, b) => b.score - a.score || a.field.localeCompare(b.field));
}

function discoveryPlan(memory = {}) {
  const facts = currentFacts(memory);
  const ranked_gaps = rankDiscoveryGaps(memory);
  const core_ready = requiredCoreFields.every(key => {
    const fact = facts.get(key);
    return fact && ["medium", "high"].includes(fact.confidence);
  });
  return {
    ranked_gaps,
    next_gap: ranked_gaps.find(gap => gap.status !== "captured") || null,
    core_ready,
    checkpoint_ready: core_ready,
    required_fields: requiredCoreFields
  };
}

module.exports = { discoveryFields, requiredCoreFields, currentFacts, rankDiscoveryGaps, discoveryPlan };
