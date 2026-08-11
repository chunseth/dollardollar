# Targeted Golden-Path Implementation Phases

## Purpose

This plan converts the audit in `INITIAL_PROMPT_COMPLETION_METRICS.md` into the smallest implementation sequence for one complete founder loop:

```text
Discovery
→ actionable checkpoint
→ working assumption
→ customer-interview experiment
→ founder result report
→ structured evidence
→ founder review
→ approved belief update
→ replanning
→ materially different recommendation
```

The first guided workflow is customer interviews for the physical-therapy-clinic scenario used in the audit.

This plan is intentionally narrower than a full guided-execution platform. It reuses the existing conversation, discovery, experiment, evidence, change-set, belief, recommendation, and roadmap systems.

## Planned test fixture layout

The implementation should eventually add the following fixture directory. This phase document defines the contents and ownership of those files; it does not create the fixtures or executable tests yet.

```text
/tests/product-loops/
    /pt-adherence/
        scenario.json
        founder-turns.json
        interview-results.json
        expected-checkpoint.json
        expected-evidence.json
        expected-state-transitions.json
```

### `scenario.json`

Stable scenario identity and setup data:

- Scenario ID: `pt-adherence`.
- Startup idea and project seed values.
- Target customer: independently owned physical therapy clinics.
- Candidate buyer: clinic owner.
- Initial offer/pricing hypothesis.
- Highest-risk uncertainty: whether poor adherence is painful enough to motivate a paid solution, especially a standalone $100/month product.

### `founder-turns.json`

Ordered founder messages for discovery and checkpoint formation. AI wording is deliberately absent from this fixture. Each turn should identify only the expected semantic contribution, such as:

- Solution idea.
- Target customer.
- Current workaround or problem context.
- Likely buyer.
- Pricing hypothesis.

### `interview-results.json`

Founder result reports covering at least:

- The primary mixed/negative report from four clinic owners.
- A positive result variant.
- An inconclusive result variant.
- An ambiguous report with insufficient experiment identification.

Each result should specify expected observations and expected review behavior, not a required assistant response.

### `expected-checkpoint.json`

State assertions for the discovery-to-action boundary:

- Actionable checkpoint status.
- Fields that must be known.
- Fields intentionally allowed to remain unknown.
- Working memory classifications.
- Highest-priority uncertainty.
- Founder-reviewed assumption candidate.

This file must explicitly prove that the checkpoint is not equivalent to completing every discovery field.

### `expected-evidence.json`

Observation-level assertions for the interview report:

- Observation type/classification.
- Counts and denominators, such as `4/4`, `3/4`, `2/4`, and `0/4`.
- Source founder-turn ID.
- Experiment ID.
- Assumption relationship.
- Review state before approval.

Interpretations and belief changes belong in the state-transition fixture, not in the raw observation expectations.

### `expected-state-transitions.json`

Lifecycle and replan assertions:

- Checkpoint becomes actionable.
- Assumption is created as low-confidence and unvalidated.
- Interview experiment is proposed and linked to the assumption.
- Founder approval activates the experiment.
- Result report creates pending evidence/interpretation proposals.
- Original assumption remains unchanged before review.
- Founder approval applies the reviewed changes.
- Experiment completes with provenance.
- Old recommendation is superseded.
- New recommendation references the interview evidence and differs materially from the old recommendation.

The fixture may assert recommendation identity and supporting evidence IDs. It should avoid hardcoding the exact new recommendation wording unless the planner contract makes the result deterministic.

## Assertion policy

The product-loop test must assert persisted state and relationships, not generated prose. Valid assertions include:

- Project lifecycle/readiness state.
- Memory aspect, classification, confidence, and review state.
- Assumption status, priority, and provenance.
- Experiment-to-assumption relationship.
- Experiment execution context.
- Evidence classification and source-turn relationship.
- Change-set lifecycle.
- Belief/assumption state before and after approval.
- Recommendation supersession and supporting evidence.

Response wording may be recorded for debugging, but it must not be a required pass condition.

## Three-layer validation strategy

The complete golden path should not require a real model call at every transition. Validation is split by purpose and reliability.

### Layer 1 — Deterministic state-machine tests

These tests mock the LLM and feed known structured outputs into the application services. They run on every commit and are the primary regression suite for lifecycle correctness.

The state machine under test is:

```text
DISCOVERY
→ ACTIONABLE
→ ASSUMPTION
→ EXPERIMENT_PROPOSED
→ ACTIVE
→ RESULT_REPORTED
→ EVIDENCE_EXTRACTED
→ PENDING_REVIEW
→ APPROVED
→ BELIEF_CHANGED
→ REPLANNED
```

Deterministic tests must assert:

- Database state after each transition.
- Valid relationship IDs between assumptions, experiments, evidence, source turns, and recommendations.
- No canonical mutation before founder approval.
- Idempotent retries and duplicate-report handling.
- Negative, mixed, inconclusive, and ambiguous result paths.
- Recommendation supersession and materially changed next state.

They must not call the live model or assert assistant wording.

### Layer 2 — LLM contract and evaluation tests

These tests use the actual model against fixed founder messages and validate structured output. They are not byte-for-byte snapshot tests.

The evaluation set should measure:

- Whether a reasonable consequential assumption was identified.
- Whether evidence was separated from interpretation.
- Whether weak or mixed evidence avoided being presented as validation.
- Whether the result was linked to the correct experiment or marked ambiguous.
- Whether observations preserved counts, denominators, and source provenance.
- Whether the output satisfied the structured contract.
- Whether unsupported facts or invented validation were avoided.

Run multiple cases and report pass rates by evaluation dimension and model version. These tests may run on a slower schedule or in a separate CI job because model behavior is probabilistic and externally dependent.

### Layer 3 — Human product test

This is a product-validation test, not a unit or integration test.

Give a real participant only:

> Bring one startup idea.

Observe whether they can independently:

- Explain the idea through the conversation.
- Reach an actionable checkpoint.
- Understand and accept the proposed assumption and experiment.
- Use the generated interview materials.
- Report evidence.
- Review and approve or reject interpretations.
- Recognize that the next recommendation changed because of the evidence.

The observer should record points of confusion, manual coaching, abandonment, trust concerns, and whether the participant understands the difference between observation and interpretation.

Human testing should not be converted into an automated pass/fail assertion. It should produce product findings and prioritized follow-up work.

## Current repository baseline

Already available:

- Discovery facts, confidence-qualified discovery planning, checkpoint synthesis, and founder confirmation.
- `memory_items` with classification, confidence, evidence status, review state, provenance, and supersession.
- Assumptions, experiments, evidence, and relationship tables.
- Topic chat sessions and task/experiment chat prefill.
- Background enrichment jobs with retries and idempotency.
- AI change sets with founder approval, rejection, editing, atomic application, and audit events.
- Versioned beliefs and recommendation recalculation.
- Roadmap graph storage with visible milestones and hidden operational nodes.

The main break is that these boundaries are not connected into one safe lifecycle. Discovery still gates on core-field completeness, completion detection is regex-based, result reports do not reliably create linked evidence, and approved belief changes do not consistently alter planner-facing assumption state.

## Implementation principles

1. Keep discovery readiness and actionability readiness separate.
2. Preserve the raw founder report before enrichment or interpretation.
3. Treat observations, interpretations, and approved beliefs as different layers.
4. Use the existing change-set review boundary for all material AI changes.
5. Prefer existing relationship tables over roadmap graph duplication.
6. Do not introduce a generic workflow engine, interpretation table, or new artifact system for this milestone.
7. Do not expand the milestone-selection policy beyond the replan behavior required by the golden path.

## Lifecycle mapping for the first slice

The implementation should use the existing experiment and change-set primitives rather than introducing a second workflow engine.

| Product state | Existing persistence | Required behavior |
|---|---|---|
| `PROPOSED` | `experiments.status='proposed'` | Interview experiment is linked to one assumption and awaits founder acceptance. |
| `ACTIVE` | `experiments.status='running'` | Founder has accepted or started the interview work. |
| `RESULT_REPORTED` | Raw founder turn plus experiment execution metadata | Founder report is durable before interpretation. |
| `PENDING_REVIEW` | AI change set `status='pending_review'` | Evidence and proposed belief changes are visible but not canonical. |
| `COMPLETED` | `experiments.status='completed'` after apply | Approved evidence, belief changes, and experiment state are applied atomically. |

This mapping avoids changing the existing experiment status enum in the first slice. If product validation later requires the intermediate states to be directly queryable on experiments, add an explicit lifecycle column in a follow-up migration.

# Phase 0 — Lock the contract and golden-path fixture

## Objective

Create the integration-test seam and structured contract needed by all later phases before changing user-visible behavior.

## Implementation tickets

### 0.1 Add the canonical golden-path fixture

Create the six files described in [Planned test fixture layout](#planned-test-fixture-layout) and make them reusable by the product-loop integration test. The fixture should cover:

- Physical-therapy-clinic startup idea.
- Adherence/payment assumption.
- Customer-interview experiment.
- Four-interview result report.
- Positive, negative, and inconclusive result variants.

The fixture should identify the expected pre-experiment recommendation and expected materially different post-review recommendation.

### 0.2 Define execution intent

Extend the existing cofounder output/enrichment contract with an optional `execution_intent` object:

```json
{
  "event": "result_reported",
  "target_type": "experiment",
  "target_id": "...",
  "certainty": "certain|ambiguous|not_detected",
  "ambiguity_reason": "...",
  "observations": [],
  "proposed_evidence": [],
  "proposed_belief_changes": []
}
```

The contract must permit the raw founder message to be saved even when the intent is ambiguous or invalid.

### 0.3 Define evidence and interpretation payloads

Use the existing domain records:

- `evidence` stores observations.
- Change-set rationale and item payloads store proposed interpretations.
- `belief_versions` store approved belief changes.

Do not add an interpretation table.

## Schema migration

None required for the contract itself. Persist the new payload in existing `conversation_turns.structured_payload` and `change_sets.proposal_metadata`.

## Acceptance tests

- Contract accepts a certain interview result.
- Contract accepts an ambiguous report without producing a mutation.
- Contract rejects unsupported target IDs and cross-project references.
- Raw founder turns persist when model output is malformed or enrichment fails.

## Exit condition

The repository can represent a structured execution result without changing canonical experiment, evidence, assumption, belief, or roadmap state.

# Phase 1 — Make the checkpoint actionable

## Objective

Allow discovery to end when the company is understood well enough to test one consequential uncertainty, even if nonessential discovery fields remain unknown.

## Implementation tickets

### 1.1 Separate readiness predicates

Keep the current core discovery readiness predicate. Add:

- `discovery_ready`
- `actionability_ready`
- `checkpoint_ready` as the product-facing combination

Actionability requires:

- One consequential uncertainty or assumption.
- One prioritized next move.
- Founder or participant owner.
- Expected evidence.
- Observable completion boundary.

### 1.2 Show one assumption candidate in checkpoint review

Extend checkpoint synthesis to show the candidate assumption and proposed interview action. The founder must be able to review or correct it before activation.

Only the selected assumption should be promoted into the canonical `assumptions` table. Other speculative discovery facts remain working memory.

### 1.3 Create the selected assumption during founder confirmation

Within the existing checkpoint confirmation transaction:

- Create one `assumptions` record with `untested` status.
- Create its versioned belief through the existing belief service.
- Preserve discovery source-turn provenance.
- Do not promote all inferred discovery facts.

## Schema migration

No migration appears necessary. Existing assumptions, beliefs, `checkpoint_metadata`, and event logging are sufficient.

## Acceptance tests

- A checkpoint can pass with `buyer`, `desired_outcome`, or `first_dollar_offer` unknown when the actionability requirements are met.
- A checkpoint cannot pass with only generic “keep exploring” text.
- The selected assumption is founder-confirmed and provenance-backed.
- Inferred, unselected discovery facts remain working or pending review.
- The old core-field test remains valid as a discovery-readiness test.

## Exit condition

The founder can move from the physical-therapy idea to one explicit, reviewable adherence/payment assumption and a concrete customer-interview action.

# Phase 2 — Create and run the interview experiment

## Objective

Create a useful customer-interview experiment through Cofounder chat and retain enough structured execution context to guide the founder.

## Implementation tickets

### 2.1 Add interview execution context

Add a bounded structured context payload to the existing experiment record. It should contain:

- Target customer profile.
- Learning goals.
- Interview questions.
- Outreach message/template.
- Target interview count.
- Completion-report shape.

Keep `title`, `hypothesis`, `success_metric`, `owner`, and `expected_duration` as the existing top-level fields.

### 2.2 Propose the experiment from chat

After checkpoint activation, Cofounder should propose an experiment linked to the selected assumption. The proposal must remain in a change set until the founder accepts it.

The proposal should include useful interview materials, not merely a title and hypothesis.

### 2.3 Add conversational acceptance and activation

The founder should be able to accept the experiment in chat. On acceptance:

- Apply the approved experiment proposal.
- Set the experiment to `running` when the founder starts it.
- Keep the execution context visible in the topic chat.

## Schema migration

One additive migration is likely necessary for an `experiments.execution_context` JSONB column with an object check. Do not add interview-specific tables.

If the existing database cannot safely accept the new column, the temporary fallback is `test_design`, but structured JSONB is preferred for reliable tests and rendering.

## Acceptance tests

- Experiment is linked to exactly one selected assumption.
- Acceptance is founder-controlled.
- Interview context contains target criteria, learning goals, outreach copy, and questions.
- Experiment can be continued from topic chat without manual database concepts.
- Repeated proposal/application is idempotent.

## Exit condition

The founder can accept and execute a concrete customer-interview experiment from Cofounder chat.

# Phase 3 — Replace completion regexes with safe result extraction

## Objective

Accept natural-language founder reports and convert them into durable, reviewable evidence proposals without silently changing company truth.

## Implementation tickets

### 3.1 Remove regex-driven state mutation

Delete the behavior that directly marks a task or experiment complete from narrow phrases such as `I completed this task:` or `I recorded an experiment result:`.

The raw founder turn must remain the source of truth for what was reported.

### 3.2 Resolve the target experiment

Use structured intent extraction to resolve the experiment from:

- Explicit experiment ID when available.
- Current active experiment in the session.
- Experiment title or context when unambiguous.

If multiple experiments are plausible, set `certainty='ambiguous'` and keep the experiment active.

### 3.3 Extract observations

For the golden-path report, extract observations such as:

- Four clinic owners interviewed.
- Adherence is common.
- Three said another app probably would not fix it.
- Two already use reminder software.
- None would pay $100/month for a separate tool.

Preserve the report as raw text. Observations must not be rewritten into conclusions.

### 3.4 Create linked evidence proposals

Proposed evidence must link to:

- The experiment through `evidence_experiment`.
- The assumption through `assumption_evidence` or the approved belief link.
- The founder source turn through an explicit provenance field.

The proposal remains `pending_review`.

## Schema migration

An additive migration is likely necessary for `evidence.source_turn_id` and, if needed, a small provenance JSONB field. Existing relationship tables should be reused.

## Acceptance tests

- Natural-language reports are recognized without requiring a prefix.
- Ambiguous reports remain pending and do not mutate status.
- Reports with negative or inconclusive outcomes are preserved.
- Evidence proposals contain source-turn, experiment, and assumption links.
- Enrichment retry does not duplicate evidence or change the result.

## Exit condition

The exact four-clinic report produces durable observations and a pending evidence proposal, while the experiment remains uncompleted until review.

# Phase 4 — Apply reviewed evidence and replan

## Objective

Make approval change the correct canonical state and produce a materially different next recommendation.

## Implementation tickets

### 4.1 Make completion review atomic

Extend change-set application so an approved interview result can atomically:

- Create evidence.
- Link evidence to the experiment.
- Link evidence to the assumption/belief.
- Update the experiment to completed.
- Apply the proposed belief or assumption-state change.
- Preserve source and application audit events.

If any item fails, none of the material changes should survive.

### 4.2 Align planner-facing state

The current recommendation planner reads assumptions, evidence, tasks, and experiments. Ensure approved belief changes also update the planner-facing assumption state or revise the planner to consume the approved belief state.

Do not leave a belief update isolated in `belief_versions` while recommendation ranking continues to see the old assumption.

### 4.3 Refresh recommendation and roadmap projections

After successful application:

- Supersede the old recommendation.
- Recalculate from approved state.
- Refresh affected roadmap projections.
- Return the new recommendation to chat.

The new recommendation must differ in action, priority, target, belief, or milestone—not merely wording.

### 4.4 Define the golden-path recommendation change

For the interview result in this plan, a valid changed recommendation should recognize that adherence is real but a standalone reminder app has weak willingness-to-pay and strong existing-tool competition. The next move should therefore differ materially from simply “interview more clinics about the same app.”

## Schema migration

No new table appears necessary. Change-set application and recommendation recalculation already exist. Schema changes from Phase 3 may be required for source provenance.

## Acceptance tests

- Approval changes only approved records.
- Rejection leaves canonical state unchanged.
- Old recommendation is superseded.
- Assumption/belief state reflects the reviewed evidence.
- Roadmap projection reflects the approved state.
- New recommendation is materially different.
- Positive, negative, and inconclusive results each produce a justified replan.

## Exit condition

The founder can approve the interview result and receive a materially different next action based on the new evidence.

# Phase 5 — Finish the conversational surface and validate the loop

## Objective

Make the entire golden path usable without requiring the founder to manually operate database-oriented pages.

## Implementation tickets

### 5.1 Add chat-level experiment controls

Expose only the controls needed for this loop:

- Accept proposed interview experiment.
- Start interview experiment.
- View interview execution context.
- Report result in natural language.
- Review proposed evidence and belief changes.
- Approve, edit, or reject the proposal.

Tasks, Evidence, Memory, and Roadmap remain inspection/correction surfaces.

### 5.2 Add the deterministic state-machine test

Run the complete lifecycle with mocked LLM outputs and real persistence/services:

1. Founder enters the physical-therapy idea.
2. Discovery asks focused questions.
3. Checkpoint becomes actionable with nonessential fields unknown.
4. One adherence/payment assumption is selected.
5. Interview experiment is proposed and accepted.
6. Interview materials are generated.
7. Founder reports the four interviews.
8. Observations and evidence remain pending.
9. Founder approves.
10. Memory/assumption state updates.
11. Old recommendation is superseded.
12. New recommendation is materially different.

### 5.3 Add deterministic reliability variants

Run the state-machine test with:

- Delayed enrichment.
- Failed enrichment followed by retry.
- Duplicate result submission.
- Ambiguous experiment reference.
- Negative result.
- Inconclusive result.

### 5.4 Add LLM contract/evaluation cases

Run fixed founder messages through the actual model on a slower or separate evaluation schedule. Score structured output and semantic quality by pass rate; do not require exact language.

### 5.5 Add product validation

Have founders or internal operators evaluate:

- Whether the interview plan is executable.
- Whether the outreach copy and questions are useful.
- Whether evidence and interpretation are understandable.
- Whether approval feels like control rather than friction.
- Whether the new recommendation clearly responds to the result.

## Schema migration

None beyond migrations required in Phases 2 and 3.

## Exit condition

The golden-path product test passes for positive, negative, and inconclusive interview outcomes, and the workflow is usable from Cofounder chat.

# Explicitly out of scope

The following should not block this milestone:

- Generic workflow-engine development.
- Full research and external-source ingestion.
- Artifact marketplace or artifact versioning.
- Full roadmap milestone-selection redesign.
- Conditional software-build roadmap generation.
- Rich cross-topic navigation redesign.
- Broad memory correction and contradiction UX.
- Production analytics dashboards beyond basic lifecycle events needed for debugging.

Those remain valid follow-up work, but they are not required to prove the first evidence-driven founder loop.

# Final definition of done

The implementation milestone is complete only when all deterministic conditions are true:

- Discovery can reach an actionable checkpoint without requiring every nonessential field.
- The checkpoint produces one founder-reviewed consequential assumption.
- Cofounder proposes a linked customer-interview experiment with useful execution material.
- Founder can accept and execute it from chat.
- Natural-language result reports are extracted into observations and proposed evidence.
- Ambiguous or conflicting reports remain pending review.
- Evidence links to the experiment, assumption, and founder source turn.
- Approval applies only reviewed changes with provenance.
- Planner-facing state updates after approval.
- The old recommendation is superseded.
- The next recommendation is materially different when the evidence warrants it.
- Retry, duplicate, negative, and inconclusive paths preserve the same trust guarantees.

The LLM evaluation layer should additionally report acceptable pass rates for assumption identification, evidence/interpretation separation, ambiguity handling, provenance, schema validity, and unsupported-claim avoidance. Its results should be tracked separately from deterministic correctness.

The human product test should be run before calling the workflow product-ready, but participant confusion or coaching requirements should produce product follow-up work rather than being disguised as an automated assertion.

Before declaring the implementation complete, run the deterministic suite against the actual migration state and a real Postgres-backed lifecycle. Static contract tests alone are not sufficient evidence that the state machine works end to end.
