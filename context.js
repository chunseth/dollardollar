"use strict";

// Pure deterministic context assembly. This module deliberately has no database,
// HTTP, or model dependency so a packet can be reproduced from persisted memory.
const LIMITS = Object.freeze({ assumptions: 5, evidence: 5, experiments: 5, tasks: 5, decisions: 3, turns: 6 });
const unresolvedStatuses = new Set(["untested", "testing", "contradicted"]);
const activeTaskStatuses = new Set(["todo", "doing", "blocked"]);
const activeExperimentStatuses = new Set(["proposed", "running", "paused"]);

function dateValue(record) { const value = Date.parse(record?.updated_at || record?.created_at || record?.decided_at || record?.source_date || 0); return Number.isFinite(value) ? value : 0; }
function idValue(record) { return String(record?.id || ""); }
function newestFirst(a, b) { return dateValue(b) - dateValue(a) || idValue(a).localeCompare(idValue(b)); }
function oldestFirst(a, b) { return dateValue(a) - dateValue(b) || idValue(a).localeCompare(idValue(b)); }
function numeric(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function compact(record, fields) { return Object.fromEntries(fields.filter(field => record?.[field] !== undefined && record[field] !== null).map(field => [field, record[field]])); }
function ids(records) { return records.map(record => String(record.id)).filter(Boolean); }
function addIds(target, name, records) { target[name] = ids(records); }
function normalizedCategory(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }

function evidenceQuality(evidence) {
  const strength = { weak: 1, moderate: 2, strong: 3 }[evidence.strength] || 1;
  const specificity = { low: 1, medium: 2, high: 3 }[evidence.specificity] || 1;
  const recency = { stale: 1, old: 1, medium: 2, recent: 3, current: 3 }[evidence.recency] || 1;
  const bias = { high: 0, medium: 1, low: 2 }[evidence.bias_risk] ?? 1;
  const behavior = evidence.behavior_vs_opinion === "behavior" ? 2 : evidence.behavior_vs_opinion === "mixed" ? 1 : 0;
  return { score: strength + specificity + recency + bias + behavior, strength, specificity, recency, bias, behavior };
}

function issueFor(assumption, memory) {
  const links = (memory.assumption_evidence || []).filter(link => String(link.assumption_id) === String(assumption.id));
  const evidenceById = new Map((memory.evidence || []).map(record => [String(record.id), record]));
  const linkedEvidence = links.map(link => evidenceById.get(String(link.evidence_id))).filter(Boolean);
  const qualities = linkedEvidence.map(evidenceQuality);
  const qualityAverage = qualities.length ? qualities.reduce((total, quality) => total + quality.score, 0) / qualities.length : 0;
  const relatedTasks = (memory.tasks || []).filter(task => String(task.assumption_id) === String(assumption.id));
  const relatedExperiments = (memory.experiments || []).filter(experiment => String(experiment.assumption_id) === String(assumption.id));
  const activeTasks = relatedTasks.filter(task => activeTaskStatuses.has(task.status));
  const activeExperiments = relatedExperiments.filter(experiment => activeExperimentStatuses.has(experiment.status));
  const blockedTasks = relatedTasks.filter(task => task.status === "blocked");
  const category = normalizedCategory(assumption.category);
  const revenueProximity = assumption.revenue_blocker || ["willingness_to_pay", "pricing", "revenue"].includes(category) ? 12 : 0;
  const breakdown = {
    importance: numeric(assumption.importance, 3) * 12,
    uncertainty: numeric(assumption.uncertainty, 3) * 10,
    risk_score: Math.round(numeric(assumption.risk_score, 50) * 0.35),
    revenue_proximity: revenueProximity,
    evidence_gap: Math.max(0, 14 - Math.round(qualityAverage)) + (linkedEvidence.length === 0 ? 6 : 0),
    blocker_status: blockedTasks.length ? 8 : 0,
    active_work_suppression: -(activeTasks.length * 12 + activeExperiments.length * 14)
  };
  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  return {
    assumption_id: String(assumption.id), statement: assumption.statement, status: assumption.status,
    score, breakdown: { ...breakdown, linked_evidence_count: linkedEvidence.length, evidence_quality_average: Number(qualityAverage.toFixed(2)), active_task_count: activeTasks.length, active_experiment_count: activeExperiments.length },
    source_ids: { assumptions: [String(assumption.id)], evidence: ids(linkedEvidence), tasks: ids(activeTasks), experiments: ids(activeExperiments) }
  };
}

function topUnresolvedIssue(memory) {
  const candidates = (memory.assumptions || []).filter(assumption => unresolvedStatuses.has(assumption.status || "untested")).map(assumption => issueFor(assumption, memory));
  candidates.sort((a, b) => b.score - a.score || String(a.assumption_id).localeCompare(String(b.assumption_id)));
  return candidates[0] || null;
}

function buildProjectContext(memory = {}) {
  // Lazy to avoid the planner/context circular dependency at module load time.
  const { planRecommendation } = require("./recommendation_planner");
  const recommendationPlan = planRecommendation(memory);
  const project = memory.project || null;
  const assumptions = [...(memory.assumptions || [])].sort((a, b) => numeric(b.risk_score) - numeric(a.risk_score) || newestFirst(a, b)).slice(0, LIMITS.assumptions);
  const evidence = [...(memory.evidence || [])].sort(newestFirst).slice(0, LIMITS.evidence);
  const experiments = [...(memory.experiments || [])].filter(record => activeExperimentStatuses.has(record.status)).sort(newestFirst).slice(0, LIMITS.experiments);
  const tasks = [...(memory.tasks || [])].filter(record => activeTaskStatuses.has(record.status)).sort((a, b) => (a.status === "blocked" ? -1 : 0) - (b.status === "blocked" ? -1 : 0) || oldestFirst(a, b)).slice(0, LIMITS.tasks);
  const decisions = [...(memory.decisions || [])].sort(newestFirst).slice(0, LIMITS.decisions);
  const turns = [...(memory.conversation_turns || [])].sort(newestFirst).slice(0, LIMITS.turns).sort(oldestFirst);
  const recommendation = memory.latest_recommendation || null;
  const included_memory_record_ids = {};
  if (project?.id) included_memory_record_ids.project = [String(project.id)];
  addIds(included_memory_record_ids, "assumptions", assumptions);
  addIds(included_memory_record_ids, "evidence", evidence);
  addIds(included_memory_record_ids, "experiments", experiments);
  addIds(included_memory_record_ids, "tasks", tasks);
  addIds(included_memory_record_ids, "decisions", decisions);
  addIds(included_memory_record_ids, "conversation_turns", turns);
  if (recommendation?.id) included_memory_record_ids.recommendations = [String(recommendation.id)];
  const data = {
    project_snapshot: compact(project, ["id", "name", "onboarding_state", "short_description", "stage", "status", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "validation_stage", "project_memory_summary", "founder_goal", "founder_constraints", "primary_industry"]),
    first_dollar_path: project?.first_dollar_path || {},
    top_assumptions: assumptions.map(record => compact(record, ["id", "statement", "category", "status", "priority", "confidence", "importance", "uncertainty", "risk_score", "revenue_blocker"])),
    recent_evidence: evidence.map(record => compact(record, ["id", "source_type", "source_title", "summary", "source_date", "strength", "confidence", "specificity", "recency", "bias_risk", "willingness_to_pay_signal", "behavior_vs_opinion", "created_at"])),
    active_or_proposed_experiments: experiments.map(record => compact(record, ["id", "assumption_id", "title", "hypothesis", "success_metric", "success_threshold", "status", "expected_duration", "started_at", "created_at"])),
    open_tasks: tasks.map(record => compact(record, ["id", "assumption_id", "experiment_id", "title", "description", "priority", "status", "due_date", "impact_level", "created_at"])),
    latest_decisions: decisions.map(record => compact(record, ["id", "title", "decision", "reason", "status", "decided_at", "created_at"])),
    latest_recommendation: recommendation ? compact(recommendation, ["id", "recommendation", "created_at"]) : null,
    recent_conversation_turns: turns.map(record => compact(record, ["id", "session_id", "turn_no", "actor_type", "content", "created_at"])),
    top_unresolved_issue: recommendationPlan.selected_issue,
    ranked_unresolved_issues: recommendationPlan.ranked_issues,
    deterministic_recommendation: recommendationPlan.recommendation,
    memory_record_ids: included_memory_record_ids
  };
  return { data, included_memory_record_ids };
}

module.exports = { LIMITS, buildProjectContext, buildContextPacket: buildProjectContext, topUnresolvedIssue, issueFor, evidenceQuality, normalizedCategory, unresolvedStatuses, activeTaskStatuses, activeExperimentStatuses };
