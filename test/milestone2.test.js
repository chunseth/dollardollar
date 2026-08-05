const test = require("node:test");
const assert = require("node:assert/strict");

if (!process.env.DATABASE_URL) {
  test("Milestone 2 API smoke tests", { skip: "DATABASE_URL is not set" }, () => {});
} else {
  const { createServer } = require("../server");
  const { pool } = require("../db");

  const owner = `test-founder-${Date.now()}`;
  let server;
  let baseUrl;

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
    server = createServer();
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
}
