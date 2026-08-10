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
  const issueText = normalizeIssueText(issue.statement);
  // `assumption_id` is the stable issue identity. Older imported records can
  // lack it; only then may their explicitly stored issue text be matched. We
  // deliberately never infer relevance from a task/experiment title.
  const matchesIssue = item => {
    if (item.assumption_id !== undefined && item.assumption_id !== null) return String(item.assumption_id) === id;
    return Boolean(issueText) && [item.primary_issue_text, item.issue_text, item.assumption_statement]
      .some(text => normalizeIssueText(text) === issueText);
  };
  const tasks = (memory.tasks || []).filter(item => matchesIssue(item) && activeTaskStatuses.has(item.status));
  const experiments = (memory.experiments || []).filter(item => matchesIssue(item) && activeExperimentStatuses.has(item.status));
  return { tasks, experiments };
}

function normalizeIssueText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
}

function recordTime(record) {
  const value = Date.parse(record?.updated_at || record?.created_at || record?.completed_at || record?.started_at || 0);
  return Number.isFinite(value) ? value : 0;
}

function hasNewInputFor(issue, active, memory) {
  const activeAt = Math.max(0, ...[...active.tasks, ...active.experiments].map(recordTime));
  if (!activeAt) return false;
  const evidenceIds = new Set((issue.source_ids.evidence || []).map(String));
  const evidence = (memory.evidence || []).filter(item => evidenceIds.has(String(item.id)));
  const founderTurns = (memory.conversation_turns || []).filter(item => item.actor_type === "founder");
  return [...evidence, ...founderTurns].some(item => recordTime(item) > activeAt);
}

function deterministicRecommendation(memory = {}, rankedIssues = rankUnresolvedIssues(memory)) {
  const issue = rankedIssues[0] || null;
  if (!issue) return {
    state: "wait", primary_issue: "No unresolved issue is currently recorded.", reason: "Wait for new founder input or evidence before creating more work.",
    action_payload: { rule: "no_unresolved_issue" }, confidence: 1, source_ids: [], rule: "no_unresolved_issue", issue: null
  };
  const active = activeWorkFor(issue, memory);
  const activeWithoutNewInput = (active.tasks.length || active.experiments.length) && !hasNewInputFor(issue, active, memory);
  const missingFounderKnowledge = !issue.statement?.trim() || !memory.project?.target_customer?.trim();
  // "Known" means the issue has at least one linked evidence record; an
  // otherwise low score without evidence remains eligible for relevant-work
  // waiting rather than replacing work already in progress.
  const knownLowRisk = (issue.source_ids.evidence || []).length > 0 && !issue.revenue_blocker && issue.sort.risk_score < 70 && issue.sort.uncertainty < 4;
  const criticalOutsideWorld = issue.revenue_blocker || issue.sort.risk_score >= 70 || issue.sort.uncertainty >= 4;
  // Explicit approved precedence: founder knowledge question, wait for
  // relevant active work with no newer evidence or founder input, known
  // low-risk task, then critical outside-world experiment. Active work is
  // never project-wide: it must match the deterministic top issue above.
  let state, rule, reason;
  if (missingFounderKnowledge) {
    state = "question"; rule = "missing_founder_context";
    reason = "A focused founder answer is required before assigning work for this issue.";
  } else if (activeWithoutNewInput) {
    state = "wait"; rule = "active_work";
    reason = "Relevant active work already addresses this top issue; wait for its result instead of creating competing work.";
  } else if (knownLowRisk) {
    state = "task"; rule = "known_low_risk_task";
    reason = "This known, low-risk issue is ready for one concrete validation action.";
  } else if (criticalOutsideWorld) {
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

module.exports = { rankUnresolvedIssues, deterministicRecommendation, planRecommendation, issueTieBreak, activeWorkFor, normalizeIssueText };
