"use strict";

// Pure policy: this module has no model, database, or HTTP dependency.  Its
// ordering is deliberately documented and total so the same persisted state
// always yields the same selected issue and rule result.
const { issueFor, unresolvedStatuses, activeTaskStatuses, activeExperimentStatuses } = require("./context");

function issueTieBreak(a, b) {
  // Stable precedence after score: importance, uncertainty, risk, then id.
  return b.score - a.score ||
    b.sort.importance - a.sort.importance ||
    b.sort.uncertainty - a.sort.uncertainty ||
    b.sort.risk_score - a.sort.risk_score ||
    a.assumption_id.localeCompare(b.assumption_id);
}

function rankUnresolvedIssues(memory = {}) {
  return (memory.assumptions || [])
    .filter(assumption => unresolvedStatuses.has(assumption.status || "untested"))
    .map(assumption => ({
      ...issueFor(assumption, memory),
      sort: {
        importance: Number(assumption.importance) || 3,
        uncertainty: Number(assumption.uncertainty) || 3,
        risk_score: Number(assumption.risk_score) || 50
      },
      revenue_blocker: Boolean(assumption.revenue_blocker)
    }))
    .sort(issueTieBreak)
    .map((issue, index) => ({ ...issue, rank: index + 1 }));
}

function activeWorkFor(issue, memory) {
  const id = String(issue.assumption_id);
  const tasks = (memory.tasks || []).filter(item => String(item.assumption_id) === id && activeTaskStatuses.has(item.status));
  const experiments = (memory.experiments || []).filter(item => String(item.assumption_id) === id && activeExperimentStatuses.has(item.status));
  return { tasks, experiments };
}

function deterministicRecommendation(memory = {}, rankedIssues = rankUnresolvedIssues(memory)) {
  const issue = rankedIssues[0] || null;
  if (!issue) return {
    state: "wait", primary_issue: "No unresolved issue is currently recorded.", reason: "Wait for new founder input or evidence before creating more work.",
    action_payload: { rule: "no_unresolved_issue" }, confidence: 1, source_ids: [], rule: "no_unresolved_issue", issue: null
  };
  const active = activeWorkFor(issue, memory);
  const projectActiveWork = {
    tasks: (memory.tasks || []).filter(item => activeTaskStatuses.has(item.status)),
    experiments: (memory.experiments || []).filter(item => activeExperimentStatuses.has(item.status))
  };
  // Explicit precedence: active work suppresses new asks; missing context
  // requires a question; critical risks get bounded experiments; all others
  // get a concrete task.
  let state, rule, reason;
  if (projectActiveWork.tasks.length || projectActiveWork.experiments.length) {
    state = "wait"; rule = "active_work";
    reason = "Active work already addresses this top issue; wait for its result instead of creating competing work.";
  } else if (!issue.statement?.trim() || !memory.project?.target_customer?.trim()) {
    state = "question"; rule = "missing_founder_context";
    reason = "A focused founder answer is required before assigning work for this issue.";
  } else if (issue.revenue_blocker || issue.sort.risk_score >= 70 || issue.sort.uncertainty >= 4) {
    state = "experiment"; rule = "critical_uncertainty";
    reason = "This high-risk unresolved issue needs a bounded test before more execution.";
  } else {
    state = "task"; rule = "actionable_validation";
    reason = "This unresolved issue is sufficiently defined for one concrete validation action.";
  }
  const source_ids = [...new Set([`assumption:${issue.assumption_id}`, ...(issue.source_ids.evidence || []).map(id => `evidence:${id}`), ...(issue.source_ids.tasks || []).map(id => `task:${id}`), ...(issue.source_ids.experiments || []).map(id => `experiment:${id}`)])];
  return {
    state, primary_issue: issue.statement, reason,
    action_payload: { rule, issue_id: issue.assumption_id, rank: issue.rank }, confidence: 1,
    source_ids, rule, issue
  };
}

function planRecommendation(memory = {}) {
  const ranked_issues = rankUnresolvedIssues(memory);
  return { ranked_issues, selected_issue: ranked_issues[0] || null, recommendation: deterministicRecommendation(memory, ranked_issues) };
}

module.exports = { rankUnresolvedIssues, deterministicRecommendation, planRecommendation, issueTieBreak };
