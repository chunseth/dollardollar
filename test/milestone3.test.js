const test = require("node:test");
const assert = require("node:assert/strict");
const { createDraft, createPlan, normalizeDraft, normalizePlan, normalizeIndustry, normalizeRevenuePath, hasUsableCoreConfidence, coreFollowUpQuestions, buildOnboardingPrompt, buildPlanPrompt, isFalsifiable, isActionableTask, industryModules, industries, projectTitle, openAIError, responseText } = require("../onboarding");
const { loadEnv } = require("../env");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("onboarding draft normalization keeps uncertainty and uses safe defaults", () => {
  const draft = normalizeDraft({
    profile: { name: { value: "Signal Forge", confidence: "high" }, target_customer: { value: "", confidence: "low" } },
    assumptions: [{ statement: "At least 3 of 10 operators will commit to a paid reporting pilot", validation_criterion: "At least 3 of 10 operators will pay a pilot deposit", category: "willingness_to_pay", priority: "high", risk_score: 120, rationale: "No purchase evidence" }],
    tasks: [{ title: "Ask for paid pilots", description: "Interview five operators", rationale: "Tests pricing", next_step: "Send five invitations", target_segment: "Independent operators", target_quantity: "10 operators", deadline: "Within 7 days", success_metric: "At least 3 of 10 operators will pay a pilot deposit", priority: "high", estimated_minutes: 20, assumption_draft_id: "assumption-1" }],
    follow_up_questions: ["Who is the first buyer?"]
  });
  assert.equal(draft.profile.name.value, "Signal Forge");
  assert.equal(draft.profile.target_customer.value, "");
  assert.equal(draft.profile.target_customer.needs_confirmation, true);
  assert.equal(draft.assumptions[0].status, "untested");
  assert.equal(draft.assumptions[0].risk_score, 100);
  assert.match(draft.assumptions[0].validation_criterion, /3 of 10/);
  assert.equal(draft.tasks[0].assumption_draft_id, "assumption-1");
  assert.equal(draft.tasks[0].target_segment, "Independent operators");
});

test("project titles are concise summaries, separate from descriptions", () => {
  assert.equal(projectTitle("AI feedback workspace for middle school teachers"), "AI feedback workspace for middle school");
  assert.equal(projectTitle("A tool that helps teachers grade written homework faster"), "A tool that helps teachers grade");
});

test("a missing AI title falls back to a concise project description", () => {
  const draft = normalizeDraft({ profile: { short_description: { value: "Invoice collection help for independent bookkeepers" } } });
  assert.equal(draft.profile.name.value, "Invoice collection help for independent bookkeepers");
});

test("all-low core profiles require focused follow-up instead of a reviewable plan", () => {
  const weak = normalizeDraft({ profile: { short_description: { value: "A tool", confidence: "low" }, target_customer: { value: "", confidence: "low" }, problem_statement: { value: "", confidence: "low" }, solution_summary: { value: "", confidence: "low" } }, industry: { primary_industry: "other", industry_confidence: "low" } });
  assert.equal(hasUsableCoreConfidence(weak), false);
  assert.equal(coreFollowUpQuestions(weak).length, 3);
  const usable = normalizeDraft({ profile: { target_customer: { value: "Middle-school math teachers", confidence: "medium" } }, industry: { primary_industry: "education", industry_confidence: "low" } });
  assert.equal(hasUsableCoreConfidence(usable), true);
});

test("environment loader uses .env values without overwriting explicit environment", () => {
  const file = path.join(os.tmpdir(), `first-dollar-env-${process.pid}.env`);
  fs.writeFileSync(file, "FIRST_DOLLAR_TEST_VALUE=from-file\n");
  delete process.env.FIRST_DOLLAR_TEST_VALUE;
  loadEnv(file);
  assert.equal(process.env.FIRST_DOLLAR_TEST_VALUE, "from-file");
  process.env.FIRST_DOLLAR_TEST_VALUE = "explicit";
  loadEnv(file);
  assert.equal(process.env.FIRST_DOLLAR_TEST_VALUE, "explicit");
  fs.unlinkSync(file);
  delete process.env.FIRST_DOLLAR_TEST_VALUE;
});

test("OpenAI quota errors are shown as funding errors", async () => {
  const error = await openAIError(new Response(JSON.stringify({ error: { code: "insufficient_quota", message: "Insufficient quota" } }), { status: 429 }));
  assert.equal(error.status, 429);
  assert.match(error.message, /credits/i);
});

test("Responses API output text is extracted from either response shape", () => {
  assert.equal(responseText({ output_text: "{\"profile\":{}}" }), "{\"profile\":{}}");
  assert.equal(responseText({ output: [{ content: [{ type: "output_text", text: "{}" }] }] }), "{}");
});

test("industry normalization keeps only the fixed module fields", () => {
  const industry = normalizeIndustry({ primary_industry: "saas", secondary_industry: "marketplace", industry_confidence: "high", industry_rationale: "Software subscription plus matching", industry_details: { buyer_role: { value: "Operations lead", confidence: "high" }, user_role: "Coordinator", unsupported: "discard" } });
  assert.equal(industry.primary_industry, "saas");
  assert.equal(industry.secondary_industry, "marketplace");
  assert.deepEqual(Object.keys(industry.industry_details), industryModules.saas.fields);
  assert.equal(industry.industry_details.buyer_role.value, "Operations lead");
  assert.equal(industry.industry_details.integration_dependency.value, "");
  assert.equal("unsupported" in industry.industry_details, false);
});

test("invalid or duplicate industry classifications safely fall back", () => {
  const industry = normalizeIndustry({ primary_industry: "fintech", secondary_industry: "other" });
  assert.equal(industry.primary_industry, "other");
  assert.equal(industry.secondary_industry, "");
  assert.deepEqual(Object.keys(industry.industry_details), industryModules.other.fields);
});

test("every supported industry has a fixed five-field prompt module", () => {
  const prompt = buildOnboardingPrompt();
  assert.deepEqual(industries, ["saas", "marketplace", "education", "local_service", "ecommerce", "healthcare", "other"]);
  for (const industry of industries) {
    assert.equal(industryModules[industry].fields.length, 5);
    assert.match(prompt, new RegExp(`${industry}:`));
    for (const field of industryModules[industry].fields) assert.match(prompt, new RegExp(field));
  }
  assert.match(buildPlanPrompt(), /cheaper behavior test/i);
  assert.match(prompt, /do not invent market facts/i);
});

test("draft normalization returns an editable industry module", () => {
  const draft = normalizeDraft({ industry: { primary_industry: "healthcare", industry_details: { care_setting: { value: "Outpatient clinics", confidence: "medium" }, sensitive_data_exposure: "Potentially yes" } } });
  assert.equal(draft.industry.primary_industry, "healthcare");
  assert.equal(draft.industry.industry_details.care_setting.value, "Outpatient clinics");
  assert.equal(draft.industry.industry_details.sensitive_data_exposure.value, "Potentially yes");
  assert.equal(draft.industry.industry_details.economic_buyer.value, "");
});

test("vague assumptions are rejected unless the statement and criterion are falsifiable", () => {
  const draft = normalizeDraft({ assumptions: [
    { statement: "Customers will like it", validation_criterion: "Customers will like it", category: "problem" },
    { statement: "At least 3 of 10 founders will schedule a demo", validation_criterion: "At least 3 of 10 founders will pay a pilot deposit", category: "willingness_to_pay" }
  ] });
  assert.equal(isFalsifiable("Customers will like it"), false);
  assert.equal(draft.assumptions.length, 1);
  assert.match(draft.assumptions[0].statement, /3 of 10/);
  assert.match(buildOnboardingPrompt(), /falsifiable/i);
});

test("tasks without a segment, quantity, deadline, metric, or assumption link are rejected", () => {
  const valid = { title: "Invite pilot prospects", next_step: "Send the invitations", target_segment: "Independent operators", target_quantity: "10 operators", deadline: "By Friday", success_metric: "At least 3 of 10 operators will pay a pilot deposit", assumption_draft_id: "assumption-1" };
  const draft = normalizeDraft({ tasks: [valid, { ...valid, deadline: "Soon" }, { ...valid, target_quantity: "Several people" }] });
  assert.equal(isActionableTask(valid), true);
  assert.equal(draft.tasks.length, 1);
  assert.match(buildPlanPrompt(), /target segment, measurable quantity, deadline/i);
});

test("common AI deadline and response language remains actionable", () => {
  const task = { title: "Invite pilot prospects", next_step: "Send invitations", target_segment: "Independent operators", target_quantity: "10 people", deadline: "Friday", success_metric: "At least 3 responses", assumption_draft_id: "assumption-1" };
  const draft = normalizeDraft({ tasks: [task] });
  assert.equal(isActionableTask(task), true);
  assert.equal(draft.tasks.length, 1);
});

test("onboarding chooses one editable first-dollar path", () => {
  const path = normalizeRevenuePath({ target_segment: { value: "Independent bookkeepers", confidence: "high" }, offer: "Invoice collection pilot", channel: "Direct email", pricing_offer: "$250 pilot", revenue_milestone: "One paid pilot" });
  assert.deepEqual(Object.keys(path), ["target_segment", "offer", "channel", "pricing_offer", "revenue_milestone"]);
  assert.equal(path.channel.value, "Direct email");
  const draft = normalizeDraft({ primary_revenue_path: path });
  assert.equal(draft.primary_revenue_path.pricing_offer.value, "$250 pilot");
  assert.match(buildOnboardingPrompt(), /exactly one target segment, offer, channel, and price/i);
  assert.match(buildOnboardingPrompt(), /do not offer alternatives/i);
});

test("only concrete post-confirmation plan items are retained", () => {
  const plan = normalizePlan({
    roadmap_milestones: [{ title: "Secure three paid pilots", description: "Ask the first ten independent bookkeepers to buy the pilot.", success_metric: "At least 3 of 10 bookkeepers will pay a pilot deposit", position: 1, assumption_index: 1 }, { title: "Build the MVP", description: "Start developing.", success_metric: "Customers will like it", position: 2, assumption_index: 1 }],
    tasks: [{ title: "Invite pilot prospects", description: "Invite independent bookkeepers.", rationale: "Tests the paid pilot assumption.", next_step: "Send 10 emails.", target_segment: "Independent bookkeepers", target_quantity: "10 bookkeepers", deadline: "By Friday", success_metric: "At least 3 replies", priority: "high", estimated_minutes: 30, assumption_index: 1 }],
    experiments: [{ title: "Paid pilot offer", hypothesis: "Bookkeepers will pay for the pilot.", test_design: "Offer the pilot over email.", success_metric: "At least 3 of 10 bookkeepers will pay a pilot deposit", expected_duration: "One week", assumption_index: 1 }]
  }, 1);
  assert.equal(plan.roadmap_milestones.length, 1);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.experiments.length, 1);
  assert.equal(plan.roadmap_milestones[0].title, "Secure three paid pilots");
  assert.match(buildOnboardingPrompt(), /exactly three highest-risk assumptions/i);
  assert.match(buildPlanPrompt(), /3-5 ordered milestones/i);
});

test("onboarding uses a bounded strict schema and defers plan generation", async t => {
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  let outgoing;
  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    outgoing = { headers: options.headers, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ output_text: JSON.stringify({
      profile: Object.fromEntries(["name", "short_description", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "stage", "founder_goal"].map(field => [field, { value: field === "name" ? "Trainer Flow" : "Independent personal trainers", confidence: "medium" }])),
      primary_revenue_path: Object.fromEntries(["target_segment", "offer", "channel", "pricing_offer", "revenue_milestone"].map(field => [field, { value: "Direct outreach", confidence: "medium" }])),
      industry: { primary_industry: "saas", secondary_industry: "", industry_confidence: "medium", industry_rationale: "Software subscription", industry_details: Object.fromEntries(industryModules.saas.fields.map(field => [field, { value: "", confidence: "low" }])) },
      assumptions: Array.from({ length: 3 }, (_, index) => ({ statement: `At least 3 of 10 trainers will pay a pilot deposit ${index + 1}`, validation_criterion: `At least 3 of 10 trainers will pay a pilot deposit ${index + 1}`, category: "willingness_to_pay", priority: "high", risk_score: 80, rationale: "No payment evidence" })),
      follow_up_questions: []
    }) }), { status: 200, headers: { "x-request-id": "request-test", "openai-processing-ms": "4" } });
  };
  t.after(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  const draft = await createDraft({ idea: "A scheduling assistant for independent personal trainers who need fewer missed appointments." });
  assert.equal(outgoing.body.text.format.type, "json_schema");
  assert.equal(outgoing.body.text.format.strict, true);
  assert.equal(outgoing.body.text.verbosity, "low");
  assert.equal(outgoing.body.max_output_tokens, 1800);
  assert.match(outgoing.headers["X-Client-Request-Id"], /^draft-/);
  assert.equal(draft.assumptions.length, 3);
  assert.deepEqual(draft.tasks, []);
  assert.deepEqual(draft.roadmap_milestones, []);
});

test("post-confirmation planner uses a separate bounded strict request", async t => {
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  let outgoing;
  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    outgoing = { headers: options.headers, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ output_text: JSON.stringify({
      roadmap_milestones: Array.from({ length: 3 }, (_, index) => ({ assumption_index: 1, title: `Milestone ${index + 1}`, description: "Offer the paid pilot to independent trainers.", success_metric: "At least 3 of 10 trainers will pay a pilot deposit", position: index + 1 })),
      tasks: Array.from({ length: 3 }, (_, index) => ({ assumption_index: 1, title: `Invite trainers ${index + 1}`, description: "Invite independent trainers to a paid pilot.", rationale: "Tests willingness to pay.", next_step: "Send ten invitations.", target_segment: "Independent personal trainers", target_quantity: "10 trainers", deadline: "By Friday", success_metric: "At least 3 replies", priority: "high", estimated_minutes: 30 })),
      experiments: [{ assumption_index: 1, title: "Paid pilot offer", hypothesis: "Trainers will pay for scheduling help.", test_design: "Offer a paid pilot through direct outreach.", success_metric: "At least 3 of 10 trainers will pay a pilot deposit", expected_duration: "One week" }]
    }) }), { status: 200, headers: { "x-request-id": "plan-test", "openai-processing-ms": "4" } });
  };
  t.after(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  const plan = await createPlan({ name: "Trainer Flow", first_dollar_path: { target_segment: "Independent trainers" } }, [{ statement: "At least 3 of 10 trainers will pay a pilot deposit", category: "willingness_to_pay", priority: "high", subcategory: "criterion" }]);
  assert.equal(outgoing.body.text.format.type, "json_schema");
  assert.equal(outgoing.body.max_output_tokens, 2400);
  assert.match(outgoing.headers["X-Client-Request-Id"], /^plan-/);
  assert.equal(plan.tasks.length, 3);
  assert.equal(plan.roadmap_milestones.length, 3);
  assert.equal(plan.experiments.length, 1);
});
