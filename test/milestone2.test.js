const test = require("node:test");
const assert = require("node:assert/strict");
require("../env").loadEnv();

if (!process.env.DATABASE_URL) {
  test("Milestone 2 API smoke tests", { skip: "DATABASE_URL is not set" }, () => {});
} else {
  const { createServer } = require("../server");
  const { pool } = require("../db");

  const owner = `test-founder-${Date.now()}`;
  let server;
  let baseUrl;
  const generatedPlan = {
    experiments: [{ assumption_index: 1, title: "Paid pilot offer", hypothesis: "Founders will pay for guidance", test_design: "Offer a paid pilot", success_metric: "At least 2 of 5 founders will pay a deposit", expected_duration: "One week" }],
    roadmap_milestones: Array.from({ length: 3 }, (_, index) => ({ assumption_index: 1, title: `Milestone ${index + 1}`, description: "Offer the paid pilot to the first five founders.", success_metric: "At least 2 of 5 founders will pay a deposit", position: index + 1 })),
    tasks: Array.from({ length: 3 }, (_, index) => ({ assumption_index: 1, title: `Invite founders ${index + 1}`, description: "Invite founders to the paid pilot.", rationale: "Tests the paid offer.", next_step: "Send five emails", target_segment: "Early-stage founders", target_quantity: "5 founders", deadline: "By Friday", success_metric: "At least 2 replies", priority: "high", estimated_minutes: 30 }))
  };

  function api(path, options = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "x-user-id": owner, ...(options.headers || {}) },
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    });
  }

  async function json(response) {
    const body = response.status === 204 ? null : await response.json();
    assert.equal(response.ok, true, JSON.stringify(body));
    return body;
  }

  test.before(async () => {
    server = createServer({ generatePlan: async () => generatedPlan });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });

  test("project and memory records can be mutated and audited", async () => {
    const created = await json(await api("/api/projects", { method: "POST", body: { name: "M2 API Smoke", target_customer: "Founders", problem_statement: "Validation is fuzzy" } }));
    const projectId = created.project.id;

    const updated = await json(await api(`/api/projects/${projectId}`, { method: "PATCH", body: { pricing_hypothesis: "$25/month" } }));
    assert.equal(updated.project.pricing_hypothesis, "$25/month");

    const assumption = (await json(await api(`/api/projects/${projectId}/assumptions`, { method: "POST", body: { statement: "Founders will pay for guided validation", category: "Willingness to pay", risk_score: 77 } }))).assumption;
    const evidence = (await json(await api(`/api/projects/${projectId}/evidence`, { method: "POST", body: { source_type: "customer_interview", source_title: "Founder call", summary: "The founder asked for pricing after the demo." } }))).evidence;
    const experiment = (await json(await api(`/api/projects/${projectId}/experiments`, { method: "POST", body: { assumption_id: assumption.id, title: "Paid pilot ask", hypothesis: "Founders will commit to a paid pilot", success_metric: "Two commitments" } }))).experiment;
    const task = (await json(await api(`/api/projects/${projectId}/tasks`, { method: "POST", body: { assumption_id: assumption.id, experiment_id: experiment.id, title: "Ask five founders for paid pilots" } }))).task;

    const updatedTask = (await json(await api(`/api/projects/${projectId}/tasks/${task.id}`, { method: "PATCH", body: { status: "doing" } }))).task;
    assert.equal(updatedTask.status, "doing");

    const assumptionEvidence = (await json(await api(`/api/projects/${projectId}/assumption-evidence`, { method: "POST", body: { assumption_id: assumption.id, evidence_id: evidence.id, relationship: "supports" } }))).link;
    const duplicateAssumptionEvidence = (await json(await api(`/api/projects/${projectId}/assumption-evidence`, { method: "POST", body: { assumption_id: assumption.id, evidence_id: evidence.id, relationship: "supports" } }))).link;
    assert.equal(duplicateAssumptionEvidence.id, assumptionEvidence.id);

    for (const body of [
      { type: "assumption_experiment", assumption_id: assumption.id, experiment_id: experiment.id },
      { type: "evidence_experiment", evidence_id: evidence.id, experiment_id: experiment.id },
      { type: "task_experiment", task_id: task.id, experiment_id: experiment.id },
      { type: "task_assumption", task_id: task.id, assumption_id: assumption.id }
    ]) {
      const relationship = (await json(await api(`/api/projects/${projectId}/relationships`, { method: "POST", body }))).relationship;
      const duplicateRelationship = (await json(await api(`/api/projects/${projectId}/relationships`, { method: "POST", body }))).relationship;
      for (const [key, value] of Object.entries(body)) if (key !== "type") {
        assert.equal(relationship[key], value);
        assert.equal(duplicateRelationship[key], value);
      }
      assert.equal(duplicateRelationship.created, false);
    }

    assert.equal((await api(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" })).status, 204);

    const memory = await json(await api(`/api/projects/${projectId}/memory`));
    for (const expected of ["Created project", "Updated company memory", "Created assumption", "Created evidence", "Created experiment", "Created task", "Updated task", "Deleted task", "Linked evidence to assumption"]) {
      assert.equal(memory.events.some(event => event.summary.includes(expected)), true, `Missing event summary containing: ${expected}`);
    }

    assert.equal((await api(`/api/projects/${projectId}`, { method: "DELETE" })).status, 204);
  });

  test("confirmed industry onboarding persists only accepted module fields", async () => {
    const draft = {
      profile: { name: { value: "Clinic Flow", confidence: "high" }, short_description: { value: "Workflow software for outpatient clinics", confidence: "medium" } },
      industry: { primary_industry: "healthcare", secondary_industry: "saas", industry_confidence: "medium", industry_rationale: "Software serving clinics", industry_details: { care_setting: { value: "Outpatient clinics", confidence: "high" }, economic_buyer: { value: "Practice manager", confidence: "medium" }, end_user: { value: "Front-desk staff", confidence: "medium" }, workflow_context: { value: "Appointment intake", confidence: "medium" }, sensitive_data_exposure: { value: "Potentially", confidence: "low" }, unsupported: { value: "discard" } } },
      assumptions: [], tasks: []
    };
    const created = await json(await api("/api/onboarding/confirm", { method: "POST", body: { draft, accepted: { profile: ["name", "short_description"], industry: { primary_industry: true, secondary_industry: false, industry_confidence: true, industry_rationale: true, details: ["care_setting", "economic_buyer"] }, assumptions: [], tasks: [] } } }));
    assert.equal(created.project.primary_industry, "healthcare");
    assert.equal(created.project.short_description, "Workflow software for outpatient clinics");
    assert.equal(created.project.secondary_industry, null);
    assert.deepEqual(created.project.industry_details, { care_setting: "Outpatient clinics", economic_buyer: "Practice manager" });
    const memory = await json(await api(`/api/projects/${created.project.id}/memory`));
    assert.equal(memory.project.industry_rationale, "Software serving clinics");
    assert.equal((await api(`/api/projects/${created.project.id}`, { method: "DELETE" })).status, 204);
  });

  test("onboarding projects accepted assumptions into initial beliefs", async () => {
    const draft = { profile: { name: { value: "Belief onboarding", confidence: "high" } }, assumptions: [{ statement: "At least 3 of 10 operators will agree to a paid pilot.", validation_criterion: "At least 3 of 10 operators will agree to a paid pilot.", category: "willingness_to_pay", priority: "high", risk_score: 80, rationale: "Payment validates demand." }], tasks: [] };
    const created = await json(await api("/api/onboarding/confirm", { method: "POST", body: { draft, accepted: { profile: ["name"], assumptions: ["assumption-1"], tasks: [] } } }));
    const beliefs = await pool.query("SELECT b.origin_assumption_id, bv.version_number, bv.statement FROM beliefs b JOIN belief_versions bv ON bv.id=b.current_version_id WHERE b.project_id=$1", [created.project.id]);
    assert.equal(beliefs.rowCount, 1);
    assert.equal(beliefs.rows[0].version_number, 1);
    assert.equal(beliefs.rows[0].statement, draft.assumptions[0].statement);
    assert.equal((await api(`/api/projects/${created.project.id}`, { method: "DELETE" })).status, 204);
  });

  test("post-confirmation plan saves linked milestones, tasks, and experiments", async () => {
    const created = await json(await api("/api/projects", { method: "POST", body: { name: "Planner smoke" } }));
    const projectId = created.project.id;
    const assumption = (await json(await api(`/api/projects/${projectId}/assumptions`, { method: "POST", body: { statement: "Founders will pay for guided validation", category: "willingness_to_pay", risk_score: 80 } }))).assumption;
    const plan = await json(await api(`/api/projects/${projectId}/plan`, { method: "POST" }));
    assert.deepEqual(plan.plan, { tasks: 3, experiments: 1, milestones: 3 });
    const memory = await json(await api(`/api/projects/${projectId}/memory`));
    assert.equal(memory.tasks.length, 3);
    assert.equal(memory.experiments.length, 1);
    assert.equal(memory.roadmap_milestones.length, 3);
    for (const item of [...memory.tasks, ...memory.experiments, ...memory.roadmap_milestones]) assert.equal(item.assumption_id, assumption.id);
    const duplicate = await api(`/api/projects/${projectId}/plan`, { method: "POST" });
    assert.equal(duplicate.status, 409);
    assert.equal((await api(`/api/projects/${projectId}`, { method: "DELETE" })).status, 204);
  });
}
