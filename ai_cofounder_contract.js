const nextStates = ["question", "task", "experiment", "wait"];
const beliefClassifications = ["unknown", "founder_statement", "assumption", "hypothesis", "evidence_observation", "finding", "decision"];
const evidenceRelationships = ["supports", "contradicts", "mixed", "neutral"];
const recordTypes = ["belief", "evidence", "task", "experiment", "decision"];
const recommendationFields = ["state", "primary_issue", "reason", "action_payload", "confidence", "source_ids"];
const deterministicRecommendationFields = ["state", "primary_issue", "reason", "action_payload", "confidence", "source_ids", "rule"];

const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0;
const isStringArray = value => Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);

function validationError(message) {
  const error = new Error(message);
  error.code = "INVALID_COFUNDER_CONTRACT";
  return error;
}

function assertAllowed(value, allowed, label) {
  if (!allowed.includes(value)) throw validationError(`Unsupported ${label}: ${value}.`);
}

function validateEvidenceLink(link) {
  if (!isObject(link)) throw validationError("Evidence links must be objects.");
  if (!isNonEmptyString(link.source_id)) throw validationError("Evidence links require a source_id.");
  assertAllowed(link.relationship, evidenceRelationships, "evidence relationship");
  return link;
}

function validateRecommendation(recommendation, { allowEmptySourceIds = false } = {}) {
  if (!isObject(recommendation)) throw validationError("Recommendation must be an object.");
  for (const field of recommendationFields) if (!(field in recommendation)) throw validationError(`Recommendation requires ${field}.`);
  assertAllowed(recommendation.state, nextStates, "next state");
  for (const field of ["primary_issue", "reason"]) if (!isNonEmptyString(recommendation[field])) throw validationError(`Recommendation ${field} must be a non-empty string.`);
  if (!isObject(recommendation.action_payload)) throw validationError("Recommendation action_payload must be an object.");
  if (typeof recommendation.confidence !== "number" || recommendation.confidence < 0 || recommendation.confidence > 1) throw validationError("Recommendation confidence must be a number from 0 to 1.");
  if (!((allowEmptySourceIds && Array.isArray(recommendation.source_ids) && recommendation.source_ids.length === 0) || isStringArray(recommendation.source_ids))) throw validationError("Recommendation requires provenance in source_ids.");
  return recommendation;
}

function validateDeterministicRecommendationContext(recommendation) {
  if (!isObject(recommendation)) throw validationError("Deterministic recommendation context must be an object.");
  for (const field of deterministicRecommendationFields) if (!(field in recommendation)) throw validationError(`Deterministic recommendation context requires ${field}.`);
  validateRecommendation(recommendation, { allowEmptySourceIds: recommendation.rule === "no_unresolved_issue" });
  if (!isNonEmptyString(recommendation.rule)) throw validationError("Deterministic recommendation context requires a rule.");
  return recommendation;
}

function validateBeliefUpdate(update) {
  if (!isObject(update)) throw validationError("Belief updates must be objects.");
  if (!isNonEmptyString(update.statement)) throw validationError("Belief updates require a statement.");
  assertAllowed(update.classification, beliefClassifications, "belief classification");
  if (!isStringArray(update.source_ids)) throw validationError("Belief updates require provenance in source_ids.");
  if (update.evidence_links !== undefined) {
    if (!Array.isArray(update.evidence_links)) throw validationError("Belief update evidence_links must be an array.");
    update.evidence_links.forEach(validateEvidenceLink);
  }
  return update;
}

function validateProposedRecord(record) {
  if (!isObject(record)) throw validationError("Proposed records must be objects.");
  assertAllowed(record.type, recordTypes, "record type");
  if (!isObject(record.payload)) throw validationError("Proposed records require an object payload.");
  if (!isStringArray(record.source_ids)) throw validationError("Proposed records require provenance in source_ids.");
  return record;
}

function validateCofounderOutput(output) {
  if (!isObject(output)) throw validationError("Cofounder output must be an object.");
  if (!isNonEmptyString(output.assistant_message)) throw validationError("Cofounder output requires assistant_message.");
  if (!Array.isArray(output.proposed_belief_updates)) throw validationError("Cofounder output requires proposed_belief_updates.");
  if (!Array.isArray(output.proposed_records)) throw validationError("Cofounder output requires proposed_records.");
  validateRecommendation(output.recommendation);
  if (typeof output.needs_founder_review !== "boolean") throw validationError("Cofounder output requires needs_founder_review.");
  output.proposed_belief_updates.forEach(validateBeliefUpdate);
  output.proposed_records.forEach(validateProposedRecord);
  return output;
}

const evidenceLinkSchema = {
  type: "object", additionalProperties: false, required: ["source_id", "relationship"],
  properties: { source_id: { type: "string", minLength: 1 }, relationship: { type: "string", enum: evidenceRelationships } }
};

const recommendationSchema = {
  type: "object", additionalProperties: false, required: recommendationFields,
  properties: {
    state: { type: "string", enum: nextStates }, primary_issue: { type: "string", minLength: 1 }, reason: { type: "string", minLength: 1 },
    action_payload: { type: "object", additionalProperties: true }, confidence: { type: "number", minimum: 0, maximum: 1 }, source_ids: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
  }
};

const deterministicRecommendationContextSchema = {
  type: "object", additionalProperties: true, required: deterministicRecommendationFields,
  properties: { ...recommendationSchema.properties, rule: { type: "string", minLength: 1 } }
};

const cofounderOutputSchema = {
  type: "object", additionalProperties: false, required: ["assistant_message", "proposed_belief_updates", "proposed_records", "recommendation", "needs_founder_review"],
  properties: {
    assistant_message: { type: "string", minLength: 1 },
    proposed_belief_updates: { type: "array", items: { type: "object", additionalProperties: false, required: ["statement", "classification", "source_ids"], properties: { statement: { type: "string", minLength: 1 }, classification: { type: "string", enum: beliefClassifications }, source_ids: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }, evidence_links: { type: "array", items: evidenceLinkSchema } } } },
    proposed_records: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "payload", "source_ids"], properties: { type: { type: "string", enum: recordTypes }, payload: { type: "object", additionalProperties: true }, source_ids: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } } } } },
    recommendation: recommendationSchema,
    needs_founder_review: { type: "boolean" }
  }
};

module.exports = { nextStates, beliefClassifications, evidenceRelationships, recordTypes, recommendationFields, deterministicRecommendationFields, evidenceLinkSchema, recommendationSchema, deterministicRecommendationContextSchema, cofounderOutputSchema, validateEvidenceLink, validateRecommendation, validateDeterministicRecommendationContext, validateBeliefUpdate, validateProposedRecord, validateCofounderOutput };
