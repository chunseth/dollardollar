"use strict";

const { currentFacts, discoveryPlan } = require("./discovery_planner");

const profileFields = Object.freeze([
  "short_description", "target_customer", "problem_statement", "solution_summary",
  "founder_goal", "pricing_hypothesis", "first_dollar_path", "primary_industry"
]);

function text(value) { return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""; }
function supported(fact) { return Boolean(fact && text(fact.statement) && ["medium", "high"].includes(fact.confidence)); }
function confidence(facts) {
  if (!facts.length) return "low";
  if (facts.every(fact => fact.confidence === "high")) return "high";
  return facts.every(supported) ? "medium" : "low";
}
function provenance(facts) {
  return {
    source: "discovery_facts",
    source_fact_ids: facts.map(fact => String(fact.id)).filter(Boolean),
    source_turn_ids: facts.map(fact => String(fact.source_turn_id)).filter(Boolean),
    classifications: [...new Set(facts.map(fact => fact.classification).filter(Boolean))]
  };
}
function field(value, facts, basis, status = null) {
  const direct = facts.length === 1 && facts[0].classification === "founder_statement";
  return {
    value: text(value),
    confidence: confidence(facts),
    status: status || (direct ? "founder_stated" : facts.length ? "needs_review" : "unresolved"),
    basis,
    provenance: provenance(facts)
  };
}
function titleSuggestion(solution) {
  const words = text(solution).replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.map(word => word[0].toUpperCase() + word.slice(1)).join(" ") : "";
}

function synthesizeCheckpoint(memory = {}) {
  const facts = currentFacts(memory);
  const get = key => facts.get(key);
  const customer = get("customer_segment");
  const problem = get("problem");
  const solution = get("solution");
  const desired = get("desired_outcome");
  const offer = get("first_dollar_offer");
  const project = memory.project || {};
  const shortDescriptionFacts = [solution, customer].filter(Boolean);
  const shortDescription = solution && customer ? `${text(solution.statement)} for ${text(customer.statement)}` : solution?.statement || customer?.statement || "";
  const pricingSupported = offer && offer.confidence === "high";
  const plan = discoveryPlan(memory);
  const fields = {
    short_description: field(shortDescription, shortDescriptionFacts, "Concise organization of the founder-stated solution and customer."),
    target_customer: field(customer?.statement, customer ? [customer] : [], "Direct mapping from customer_segment."),
    problem_statement: field(problem?.statement, problem ? [problem] : [], "Direct mapping from problem."),
    solution_summary: field(solution?.statement, solution ? [solution] : [], "Direct mapping from solution."),
    founder_goal: field(desired?.statement, desired ? [desired] : [], "Direct mapping from desired_outcome."),
    pricing_hypothesis: field(pricingSupported ? offer.statement : "", pricingSupported ? [offer] : [], "Only a high-confidence first-dollar offer is supported as a pricing hypothesis.", pricingSupported ? null : offer ? "needs_review" : null),
    first_dollar_path: field(pricingSupported ? offer.statement : "", pricingSupported ? [offer] : [], "Only a high-confidence first-dollar offer is supported as a path.", pricingSupported ? null : offer ? "needs_review" : null),
    primary_industry: field("", [], "No industry claim is made from discovery facts alone.")
  };
  const nameIsNew = !text(project.name) || text(project.name).toLowerCase() === "new project";
  const nameSuggestion = titleSuggestion(solution?.statement || customer?.statement);
  return {
    version: "checkpoint-synthesis-v1",
    readiness: plan.checkpoint_ready,
    company_name: field(nameIsNew ? "" : project.name, nameIsNew ? [] : [{ ...project, id: project.id, source_turn_id: null, classification: "founder_statement", confidence: "high" }], "Existing project name is preserved; a new name must be founder supplied."),
    company_name_suggestion: nameSuggestion ? { value: nameSuggestion, confidence: "low", status: "ai_suggestion", basis: "Derived from discovery wording; not selected automatically.", provenance: { source: "discovery_facts", source_fact_ids: [solution, customer].filter(Boolean).map(fact => String(fact.id)).filter(Boolean) } } : null,
    fields,
    profile_confidence: confidence(Object.values(fields).filter(item => item.value)),
    unresolved_gaps: plan.ranked_gaps.filter(gap => gap.status !== "captured").map(gap => ({ field: gap.field, label: gap.label, confidence: gap.confidence, status: gap.status, question: gap.question })),
    source_discovery_fact_ids: [...facts.values()].map(fact => String(fact.id)).filter(Boolean)
  };
}

module.exports = { profileFields, synthesizeCheckpoint };
