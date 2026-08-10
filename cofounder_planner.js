"use strict";

const { discoveryPlan, currentFacts } = require("./discovery_planner");

const modes = Object.freeze([
  "explorer", "synthesizer", "constructive_challenger", "evidence_interpreter",
  "product_design_partner", "execution_coach", "roadmap_planner"
]);

const aspectMap = Object.freeze({
  customer_segment: "customer",
  problem: "problem",
  context: "context",
  current_workaround: "workaround",
  desired_outcome: "goal",
  solution: "solution",
  buyer: "buyer",
  first_dollar_offer: "pricing"
});

function normalize(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function inferMode({ project = {}, message = "", recommendation = null, checkpointReady = false } = {}) {
  const text = normalize(message).toLowerCase();
  if (checkpointReady || /\b(name|call|brand)\b/.test(text)) return "synthesizer";
  if (/\b(completed|result|interview|talked to|heard from|evidence|learned)\b/.test(text)) return "evidence_interpreter";
  if (/\b(feature|design|screen|prototype|user flow|product)\b/.test(text)) return "product_design_partner";
  if (/\b(should we|decide|tradeoff|concern|wrong|risk)\b/.test(text)) return "constructive_challenger";
  if (recommendation?.state === "task" || recommendation?.state === "experiment") return "execution_coach";
  if (project.onboarding_state === "active" && project.validation_stage) return "roadmap_planner";
  return "explorer";
}

function warmPrompt({ gap, mode = "explorer" }) {
  const questions = {
    customer_segment: "Who is the first person you can picture using this, and what makes them the right starting point?",
    problem: "What is happening in their world when this problem becomes impossible to ignore?",
    context: "What does the moment around this problem actually look like for them?",
    current_workaround: "What do they do today when this comes up?",
    desired_outcome: "If this worked beautifully for them, what would be noticeably different?",
    solution: "What is the smallest version of your idea that could create that outcome?",
    buyer: "Who would feel responsible for paying for that outcome?",
    first_dollar_offer: "What is the smallest paid version you could imagine offering first?"
  };
  const question = questions[gap?.field] || gap?.question || "What detail feels most important to understand next?";
  if (mode === "constructive_challenger") return `The interesting tension here is worth spending a little time with. ${question}`;
  if (mode === "evidence_interpreter") return `That detail gives us something real to work with. ${question}`;
  if (mode === "synthesizer") return `This is starting to feel like a company rather than just an idea. ${question}`;
  return question;
}

function buildPlanItems(memory = {}, { sourceIds = [], message = "" } = {}) {
  const project = memory.project || {};
  const plan = discoveryPlan(memory);
  const items = [];
  const mode = inferMode({ project, message, checkpointReady: plan.checkpoint_ready });
  if (project.onboarding_state === "discovery") {
    const gaps = plan.ranked_gaps.filter(gap => gap.status !== "captured").slice(0, 4);
    for (const gap of gaps) {
      items.push({
        intent: `discover_${gap.field}`,
        response_type: "question",
        prompt: warmPrompt({ gap, mode }),
        aspects: [aspectMap[gap.field] || gap.field],
        trigger: { field: gap.field, status: gap.status },
        source_ids: sourceIds
      });
    }
    if (plan.checkpoint_ready) items.unshift({
      intent: "checkpoint_name_company",
      response_type: "checkpoint",
      prompt: "We have enough shape to start giving this company an identity. What might you call it? We can play with a few directions together.",
      aspects: ["brand", "goal"],
      trigger: { checkpoint_ready: true },
      source_ids: sourceIds
    });
  } else {
    const recommendation = memory.latest_recommendation?.recommendation || memory.deterministic_recommendation;
    const issue = recommendation?.primary_issue || "the next most important customer-learning step";
    items.push({
      intent: "advance_top_issue",
      response_type: recommendation?.state === "experiment" ? "challenge" : "action",
      prompt: recommendation?.reason || `Let’s make progress on ${issue}.`,
      aspects: ["goal", "constraint"],
      trigger: { state: recommendation?.state || "task", issue },
      source_ids: sourceIds
    });
    items.push({
      intent: "check_for_new_evidence",
      response_type: "question",
      prompt: "What have you learned from the people or behavior closest to this decision?",
      aspects: ["customer", "evidence"],
      trigger: { after: "founder_update" },
      source_ids: sourceIds
    });
    items.push({
      intent: "offer_execution_help",
      response_type: "question",
      prompt: "Would it help to work through the outreach, interview, prototype, or decision together?",
      aspects: ["goal", "constraint"],
      trigger: { after: "recommendation" },
      source_ids: sourceIds
    });
  }
  return { mode, items: items.slice(0, 5) };
}

function extractWorkingItems({ facts = [], sourceTurnId, projectId } = {}) {
  return facts.map(fact => ({
    project_id: projectId,
    aspect: aspectMap[fact.field] || fact.field || "context",
    statement: normalize(fact.statement),
    classification: fact.classification || "inference",
    confidence: fact.confidence || "low",
    review_state: fact.classification === "founder_statement" ? "confirmed" : "working",
    source_turn_ids: sourceTurnId ? [String(sourceTurnId)] : [],
    related_entity_ids: { discovery_field: fact.field }
  })).filter(item => item.statement);
}

module.exports = {
  modes,
  aspectMap,
  inferMode,
  warmPrompt,
  buildPlanItems,
  extractWorkingItems,
  currentFacts
};
