const OPENAI_URL = "https://api.openai.com/v1/responses";
const model = process.env.OPENAI_MODEL || "gpt-5.5";
const onboardingTimeoutMs = Number(process.env.ONBOARDING_TIMEOUT_MS) || 90_000;
const draftMaxOutputTokens = Number(process.env.ONBOARDING_DRAFT_MAX_OUTPUT_TOKENS) || 1_800;
const planMaxOutputTokens = Number(process.env.ONBOARDING_PLAN_MAX_OUTPUT_TOKENS) || 2_400;

const fields = ["name", "short_description", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "stage", "founder_goal"];
const categories = new Set(["customer", "problem", "solution", "distribution", "willingness_to_pay"]);
const priorities = new Set(["high", "medium", "low"]);
const industries = ["saas", "marketplace", "education", "local_service", "ecommerce", "healthcare", "other"];
const industrySet = new Set(industries);
const industryModules = {
  saas: { fields: ["buyer_role", "user_role", "sales_motion", "pricing_metric", "integration_dependency"], guidance: "Test buyer/user separation, acute workflow pain, willingness to pay, acquisition channel, and whether integrations are necessary. Prefer interviews, paid pilots, concierge workflows, and price asks." },
  marketplace: { fields: ["supply_side", "demand_side", "transaction_unit", "market_scope", "monetization_model"], guidance: "Test both sides separately, supply availability, demand frequency, liquidity/cold-start risk, trust, and take-rate willingness. Prefer manually matching a small cohort before product development." },
  education: { fields: ["institution_type", "economic_buyer", "end_user", "adoption_context", "procurement_constraint"], guidance: "Distinguish teacher, student, and administrator roles; validate workflow and purchasing authority; account for school-calendar and procurement constraints. Do not claim learning outcomes or compliance without evidence." },
  local_service: { fields: ["service_category", "service_area", "customer_type", "delivery_model", "lead_channel"], guidance: "Test local demand, geographic density, operational capacity, scheduling, fulfillment, trust, and acquisition economics. Prefer a manual service offer and paid booking test." },
  ecommerce: { fields: ["product_category", "customer_segment", "sales_channel", "fulfillment_model", "purchase_cadence"], guidance: "Test desirability, price, channel, fulfillment feasibility, repeat intent, and margin-sensitive viability. Prefer preorders, paid samples, landing pages, or small-batch tests; do not state unverified margins." },
  healthcare: { fields: ["care_setting", "economic_buyer", "end_user", "workflow_context", "sensitive_data_exposure"], guidance: "Test stakeholder workflow pain, buyer authority, adoption, implementation burden, and data/regulatory risk. Do not provide clinical advice, claim compliance, or recommend handling sensitive data without professional review." },
  other: { fields: ["operating_model", "economic_buyer", "end_user", "transaction_or_value_unit", "go_to_market_channel"], guidance: "Use universal validation. Explicitly surface classification uncertainty or ask a targeted follow-up question when the model is unclear." }
};
const revenuePathFields = ["target_segment", "offer", "channel", "pricing_offer", "revenue_milestone"];
const coreProfileFields = ["short_description", "target_customer", "problem_statement", "solution_summary"];
const text = value => typeof value === "string" ? value.trim().slice(0, 4000) : "";
const projectTitle = value => text(value).split(/\s+/).slice(0, 6).join(" ").slice(0, 80);
const falsifiableAction = /\b(pay|paid|purchase|commit|book|schedule|reply|replies|response|responses|respond|sign|convert|complete|use|return|refer|agree|interested|interest|join|attend|try|visit|click|open)\b/i;
const measurableThreshold = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|at least|more than|less than|percent|%)\b/i;
const isFalsifiable = value => measurableThreshold.test(text(value)) && falsifiableAction.test(text(value));
const hasQuantity = value => measurableThreshold.test(text(value));
const hasDeadline = value => /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|by\b|within\b|next\b|end of\b|day|week|month|quarter|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\b/i.test(text(value));
const isActionableTask = item => Boolean(text(item.target_segment) && hasQuantity(item.target_quantity) && hasDeadline(item.deadline) && text(item.success_metric) && text(item.assumption_draft_id));
const isRoadmapMilestone = item => Boolean(text(item.title) && text(item.description) && isFalsifiable(item.success_metric));

const confidenceSchema = { type: "string", enum: ["high", "medium", "low"] };
const valueSchema = { type: "object", additionalProperties: false, required: ["value", "confidence"], properties: { value: { type: "string" }, confidence: confidenceSchema } };
const profileSchema = { type: "object", additionalProperties: false, required: fields, properties: Object.fromEntries(fields.map(field => [field, valueSchema])) };
const revenuePathSchema = { type: "object", additionalProperties: false, required: revenuePathFields, properties: Object.fromEntries(revenuePathFields.map(field => [field, valueSchema])) };
const industrySchema = { anyOf: industries.map(primary => ({
  type: "object", additionalProperties: false,
  required: ["primary_industry", "secondary_industry", "industry_confidence", "industry_rationale", "industry_details"],
  properties: {
    primary_industry: { type: "string", enum: [primary] }, secondary_industry: { type: "string" }, industry_confidence: confidenceSchema, industry_rationale: { type: "string" },
    industry_details: { type: "object", additionalProperties: false, required: industryModules[primary].fields, properties: Object.fromEntries(industryModules[primary].fields.map(field => [field, valueSchema])) }
  }
})) };
const assumptionSchema = { type: "object", additionalProperties: false, required: ["statement", "validation_criterion", "category", "priority", "risk_score", "rationale"], properties: { statement: { type: "string" }, validation_criterion: { type: "string" }, category: { type: "string", enum: [...categories] }, priority: { type: "string", enum: [...priorities] }, risk_score: { type: "integer", minimum: 0, maximum: 100 }, rationale: { type: "string" } } };
const onboardingSchema = { type: "object", additionalProperties: false, required: ["profile", "primary_revenue_path", "industry", "assumptions", "follow_up_questions"], properties: { profile: profileSchema, primary_revenue_path: revenuePathSchema, industry: industrySchema, assumptions: { type: "array", minItems: 3, maxItems: 3, items: assumptionSchema }, follow_up_questions: { type: "array", maxItems: 3, items: { type: "string" } } } };
const planItemSchema = { type: "object", additionalProperties: false, required: ["assumption_index", "title", "description", "rationale", "next_step", "target_segment", "target_quantity", "deadline", "success_metric", "priority", "estimated_minutes"], properties: { assumption_index: { type: "integer", minimum: 1 }, title: { type: "string" }, description: { type: "string" }, rationale: { type: "string" }, next_step: { type: "string" }, target_segment: { type: "string" }, target_quantity: { type: "string" }, deadline: { type: "string" }, success_metric: { type: "string" }, priority: { type: "string", enum: [...priorities] }, estimated_minutes: { type: "integer", minimum: 5, maximum: 480 } } };
const milestoneSchema = { type: "object", additionalProperties: false, required: ["assumption_index", "title", "description", "success_metric", "position"], properties: { assumption_index: { type: "integer", minimum: 1 }, title: { type: "string" }, description: { type: "string" }, success_metric: { type: "string" }, position: { type: "integer", minimum: 1 } } };
const experimentSchema = { type: "object", additionalProperties: false, required: ["assumption_index", "title", "hypothesis", "test_design", "success_metric", "expected_duration"], properties: { assumption_index: { type: "integer", minimum: 1 }, title: { type: "string" }, hypothesis: { type: "string" }, test_design: { type: "string" }, success_metric: { type: "string" }, expected_duration: { type: "string" } } };
const planSchema = { type: "object", additionalProperties: false, required: ["roadmap_milestones", "tasks", "experiments"], properties: { roadmap_milestones: { type: "array", minItems: 3, maxItems: 5, items: milestoneSchema }, tasks: { type: "array", minItems: 3, maxItems: 6, items: planItemSchema }, experiments: { type: "array", minItems: 1, maxItems: 3, items: experimentSchema } } };

async function openAIError(response) {
  let payload = {};
  try { payload = await response.json(); } catch {}
  const code = payload?.error?.code;
  const detail = text(payload?.error?.message).slice(0, 240);
  const error = new Error("Unable to create an onboarding draft.");
  if (response.status === 401) error.message = "OpenAI rejected the API key. Check OPENAI_API_KEY in .env and restart the server.";
  else if (response.status === 429 && code === "insufficient_quota") error.message = "OpenAI account credits are unavailable. Add API credits or use a funded API key, then try again.";
  else if (response.status === 429) error.message = "OpenAI is rate-limiting onboarding requests. Please wait a minute and try again.";
  else if (code === "model_not_found" || response.status === 404) error.message = `The configured OpenAI model (${model}) is unavailable for this API key.`;
  else if (response.status === 400 && detail) error.message = `OpenAI rejected the onboarding request: ${detail}`;
  error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
  error.openaiCode = code;
  return error;
}

function responseText(result) {
  if (typeof result?.output_text === "string") return result.output_text;
  return result?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "";
}

function normalizeIndustry(raw) {
  const primary = industrySet.has(raw?.primary_industry) ? raw.primary_industry : "other";
  const secondary = industrySet.has(raw?.secondary_industry) && raw.secondary_industry !== primary ? raw.secondary_industry : "";
  const source = raw?.industry_details && typeof raw.industry_details === "object" ? raw.industry_details : {};
  const details = {};
  for (const field of industryModules[primary].fields) {
    const input = source[field];
    details[field] = { value: text(typeof input === "object" ? input.value : input), confidence: ["high", "medium", "low"].includes(input?.confidence) ? input.confidence : "low" };
  }
  return { primary_industry: primary, secondary_industry: secondary, industry_confidence: ["high", "medium", "low"].includes(raw?.industry_confidence) ? raw.industry_confidence : "low", industry_rationale: text(raw?.industry_rationale), industry_details: details };
}

function normalizeRevenuePath(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(revenuePathFields.map(field => [field, { value: text(typeof source[field] === "object" ? source[field].value : source[field]), confidence: ["high", "medium", "low"].includes(source[field]?.confidence) ? source[field].confidence : "low" }]));
}

function hasUsableCoreConfidence(draft) {
  return coreProfileFields.some(field => ["medium", "high"].includes(draft.profile[field]?.confidence)) || ["medium", "high"].includes(draft.industry.industry_confidence);
}

function coreFollowUpQuestions(draft) {
  const questions = [];
  if (!["medium", "high"].includes(draft.industry.industry_confidence)) questions.push("Who is the first person or organization you expect to pay, and what category of business are they in?");
  if (!["medium", "high"].includes(draft.profile.target_customer?.confidence)) questions.push("Which specific customer will you contact first (role, organization type, and context)?");
  if (!["medium", "high"].includes(draft.profile.problem_statement?.confidence)) questions.push("What recurring problem do they have today, and how are they handling it without your product?");
  if (!["medium", "high"].includes(draft.profile.solution_summary?.confidence)) questions.push("What is the smallest paid outcome you can offer this customer in the next two weeks?");
  return questions.slice(0, 3);
}

function buildOnboardingPrompt() {
  const taxonomy = industries.map(industry => `${industry}: ${industryModules[industry].fields.join(", ")}`).join("\n");
  return `Create a cautious, editable onboarding draft from a founder's idea. Return only the supplied JSON schema. Do not invent market facts, demand, prices, compliance status, or evidence.\n\nFor profile and primary_revenue_path, make direct reasonable inferences; use an empty value with low confidence when unknown. name is a memorable 2-6 word title, not a sentence. Choose exactly one target segment, offer, channel, and price for the first-dollar path; do not offer alternatives. Classify one primary industry and fill only its five industry_details fields.\n\nIndustry fields:\n${taxonomy}\n\nReturn exactly three highest-risk assumptions. Each must be an observable, falsifiable behavior with a measurable threshold in both statement and validation_criterion. Prioritize willingness-to-pay and other revenue blockers. Example: “At least 3 of 10 interviewed operators will agree to a paid pilot.” Never use vague claims such as “Customers will like it.” Add up to three focused follow-up questions only for important unknowns. Do not create tasks, experiments, or a roadmap yet; those are generated after the founder validates this core.`;
}

function buildPlanPrompt() {
  return `Create a concise validation plan from confirmed company memory and its selected assumptions. Return only the supplied JSON schema. Every item must serve the one confirmed first-dollar path. Prefer a cheaper behavior test over building. Do not invent facts, alternate personas, channels, or prices.\n\nReturn 3-5 ordered milestones, 3-6 tasks, and 1-3 experiments. For every item, set assumption_index to the matching assumption's 1-based index from the input. Every task needs a target segment, measurable quantity, deadline, next step, and measurable success metric. Every milestone and experiment needs a measurable, observable success metric. Keep each field short and concrete.`;
}

function normalizeDraft(raw, fallbackTitle = "") {
  const profile = {};
  for (const field of fields) {
    const input = raw?.profile?.[field];
    const value = field === "name" ? projectTitle(typeof input === "object" ? input.value : input) : text(typeof input === "object" ? input.value : input);
    profile[field] = { value, confidence: ["high", "medium", "low"].includes(input?.confidence) ? input.confidence : "low", needs_confirmation: true };
  }
  if (!profile.name.value) profile.name = { value: projectTitle(fallbackTitle || profile.short_description.value || profile.solution_summary.value) || "New venture", confidence: "low", needs_confirmation: true };
  const assumptions = Array.isArray(raw?.assumptions) ? raw.assumptions.slice(0, 10).map((item, index) => ({
    draft_id: `assumption-${index + 1}`, statement: text(item.statement), category: categories.has(item.category) ? item.category : "problem",
    priority: priorities.has(item.priority) ? item.priority : "medium", risk_score: Number.isInteger(item.risk_score) ? Math.max(0, Math.min(100, item.risk_score)) : 50,
    rationale: text(item.rationale), validation_criterion: text(item.validation_criterion), status: "untested"
  })).filter(item => isFalsifiable(item.statement) && isFalsifiable(item.validation_criterion)) : [];
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, 10).map((item, index) => ({
    draft_id: `task-${index + 1}`, title: text(item.title), description: text(item.description), rationale: text(item.rationale), next_step: text(item.next_step), target_segment: text(item.target_segment), target_quantity: text(item.target_quantity), deadline: text(item.deadline), success_metric: text(item.success_metric),
    priority: priorities.has(item.priority) ? item.priority : "medium", estimated_minutes: Number.isInteger(item.estimated_minutes) ? Math.max(5, Math.min(480, item.estimated_minutes)) : 30,
    assumption_draft_id: text(item.assumption_draft_id)
  })).filter(item => item.title && item.next_step && isActionableTask(item)) : [];
  const roadmap_milestones = Array.isArray(raw?.roadmap_milestones) ? raw.roadmap_milestones.slice(0, 5).map((item, index) => ({ draft_id: `milestone-${index + 1}`, title: text(item.title), description: text(item.description), success_metric: text(item.success_metric), position: Number.isInteger(item.position) && item.position > 0 ? item.position : index + 1, assumption_draft_id: text(item.assumption_draft_id) })).filter(item => isRoadmapMilestone(item)) : [];
  return { profile, primary_revenue_path: normalizeRevenuePath(raw?.primary_revenue_path), industry: normalizeIndustry(raw?.industry), assumptions, roadmap_milestones, tasks, follow_up_questions: Array.isArray(raw?.follow_up_questions) ? raw.follow_up_questions.map(text).filter(Boolean).slice(0, 5) : [] };
}

async function createDraft(input) {
  const idea = text(input?.idea);
  if (idea.length < 20) { const error = new Error("Please share a little more about the idea so a useful draft can be created."); error.status = 422; throw error; }
  if (!process.env.OPENAI_API_KEY) { const error = new Error("AI onboarding is not configured. Add OPENAI_API_KEY to .env and restart the server."); error.status = 503; throw error; }
  const result = await requestModel("draft", buildOnboardingPrompt(), onboardingSchema, { idea, hints: { target_customer: text(input.customer), problem: text(input.problem), solution: text(input.solution), pricing: text(input.price), progress: text(input.progress), goal: text(input.goal) } }, draftMaxOutputTokens);
  const draft = normalizeDraft(result, idea);
  if (draft.assumptions.length !== 3) { const error = new Error("The AI draft did not contain three usable assumptions. Please try again."); error.status = 502; throw error; }
  if (hasUsableCoreConfidence(draft)) return draft;
  draft.requires_follow_up = true;
  draft.assumptions = [];
  draft.follow_up_questions = coreFollowUpQuestions(draft);
  return draft;
}

async function requestModel(kind, prompt, schema, input, maxOutputTokens) {
  const requestId = `${kind}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const startedAt = Date.now(), controller = new AbortController(), timeout = setTimeout(() => controller.abort(), onboardingTimeoutMs);
  let response;
  try {
    console.info(`[onboarding:${requestId}] OpenAI request started`, { model, timeoutMs: onboardingTimeoutMs, maxOutputTokens });
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "X-Client-Request-Id": requestId },
      signal: controller.signal,
      body: JSON.stringify({ model, store: false, max_output_tokens: maxOutputTokens, text: { verbosity: "low", format: { type: "json_schema", name: `onboarding_${kind}`, strict: true, schema } }, input: [
        { role: "system", content: [{ type: "input_text", text: prompt }] }, { role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] }
      ] })
    });
  } catch (cause) {
    const timedOut = controller.signal.aborted;
    console.error(`[onboarding:${requestId}] OpenAI request ${timedOut ? "timed out" : "failed"}`, { durationMs: Date.now() - startedAt, errorName: cause?.name, errorMessage: cause?.message });
    const error = new Error(timedOut ? "AI onboarding took too long. Please try again." : "Could not reach OpenAI. Check this server's internet connection and try again."); error.status = timedOut ? 504 : 503; error.cause = cause; throw error;
  } finally { clearTimeout(timeout); }
  console.info(`[onboarding:${requestId}] OpenAI response received`, { status: response.status, durationMs: Date.now() - startedAt, requestId: response.headers.get("x-request-id"), processingMs: response.headers.get("openai-processing-ms") });
  if (!response.ok) throw await openAIError(response);
  const result = await response.json();
  try {
    const parsed = JSON.parse(responseText(result) || "{}");
    console.info(`[onboarding:${requestId}] OpenAI response parsed`, { durationMs: Date.now() - startedAt, usage: result.usage });
    return parsed;
  } catch (cause) { console.error(`[onboarding:${requestId}] Invalid OpenAI response`, { durationMs: Date.now() - startedAt, errorName: cause?.name, errorMessage: cause?.message }); const error = new Error("The AI returned an invalid onboarding draft. Please try again."); error.status = 502; throw error; }
}

function normalizePlan(raw, assumptionCount) {
  const validIndex = value => Number.isInteger(value) && value >= 1 && value <= assumptionCount;
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, 6).map(item => ({ assumption_index: item.assumption_index, title: text(item.title), description: text(item.description), rationale: text(item.rationale), next_step: text(item.next_step), target_segment: text(item.target_segment), target_quantity: text(item.target_quantity), deadline: text(item.deadline), success_metric: text(item.success_metric), priority: priorities.has(item.priority) ? item.priority : "medium", estimated_minutes: Number.isInteger(item.estimated_minutes) ? Math.max(5, Math.min(480, item.estimated_minutes)) : 30 })).filter(item => validIndex(item.assumption_index) && item.title && item.next_step && isActionableTask({ ...item, assumption_draft_id: "selected" })) : [];
  const roadmap_milestones = Array.isArray(raw?.roadmap_milestones) ? raw.roadmap_milestones.slice(0, 5).map((item, index) => ({ assumption_index: item.assumption_index, title: text(item.title), description: text(item.description), success_metric: text(item.success_metric), position: Number.isInteger(item.position) && item.position > 0 ? item.position : index + 1 })).filter(item => validIndex(item.assumption_index) && isRoadmapMilestone(item)) : [];
  const experiments = Array.isArray(raw?.experiments) ? raw.experiments.slice(0, 3).map(item => ({ assumption_index: item.assumption_index, title: text(item.title), hypothesis: text(item.hypothesis), test_design: text(item.test_design), success_metric: text(item.success_metric), expected_duration: text(item.expected_duration) })).filter(item => validIndex(item.assumption_index) && item.title && item.hypothesis && isFalsifiable(item.success_metric)) : [];
  return { tasks, roadmap_milestones, experiments };
}

async function createPlan(project, assumptions) {
  if (!assumptions.length) { const error = new Error("Confirm at least one assumption before generating a validation plan."); error.status = 422; throw error; }
  const profile = Object.fromEntries(["name", "short_description", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "founder_goal", "first_dollar_path", "primary_industry", "industry_details"].map(field => [field, project[field]]));
  const result = await requestModel("plan", buildPlanPrompt(), planSchema, { profile, assumptions: assumptions.map((item, index) => ({ assumption_index: index + 1, statement: item.statement, category: item.category, priority: item.priority, validation_criterion: item.subcategory })) }, planMaxOutputTokens);
  const plan = normalizePlan(result, assumptions.length);
  if (plan.roadmap_milestones.length < 3 || plan.tasks.length < 3 || plan.experiments.length < 1) { const error = new Error("The AI plan did not contain enough usable validation items. Please try again."); error.status = 502; throw error; }
  return plan;
}

module.exports = { createDraft, createPlan, normalizeDraft, normalizePlan, normalizeIndustry, normalizeRevenuePath, hasUsableCoreConfidence, coreFollowUpQuestions, buildOnboardingPrompt, buildPlanPrompt, isFalsifiable, isActionableTask, isRoadmapMilestone, fields, industries, industryModules, revenuePathFields, projectTitle, openAIError, responseText };
