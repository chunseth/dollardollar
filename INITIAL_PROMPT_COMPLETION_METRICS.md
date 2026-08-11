# Initial Prompt Completion Metrics

## Scope

This report evaluates the repository against the original product request, **“Cofounder as the Product’s Main Operating Loop.”** It uses the current source code, migrations, API routes, frontend behavior, and automated tests as evidence.

These are implementation-completion metrics, not user-usage metrics. The repository does not currently instrument production behavior such as checkpoint conversion, response latency, extraction precision, or first-dollar outcomes, so those metrics are specified as the next measurement layer.

Audit date: 2026-08-10

## Executive summary

The project has implemented the core persistence and orchestration foundation for a conversation-first AI cofounder:

- Database-backed conversation sessions, context packets, turns, recommendations, queued plan items, background jobs, discovery facts, memory items, change sets, and roadmap graph tables exist.
- Discovery conversations use a deterministic gap planner and can precompute several warm follow-up questions.
- Founder messages are persisted before enrichment, and enrichment failures do not prevent the saved chat response from being returned.
- A natural checkpoint and naming moment exists, with a reviewable snapshot and founder confirmation gate.
- Hidden cofounder modes and warm discovery prompts are represented in the planner and model contract.
- The full automated suite passed: **79 tests passed, 0 failed**.

The implementation is best described as a strong foundation with an estimated **65% implementation coverage** of the original plan. The estimate is weighted across the six major architecture areas and reflects that several areas have real infrastructure but incomplete user-facing behavior.

The largest product risks are:

1. The roadmap graph exists, but its milestone selection and dependency model do not yet implement the full first-dollar planning policy.
2. Guided execution is mostly a prefilled chat composer rather than a complete task, experiment, research, and artifact workflow.
3. Completion detection uses narrow text patterns and can silently update records without an explicit ambiguity-review path.
4. There is no product analytics layer to measure whether the conversation actually feels fast, warm, useful, or successful.

## Reinterpretation of this report

This report should be used as a completion baseline with the following treatment:

### Keep

- The current scorecard and weighted implementation estimate.
- The current 14-theme test coverage assessment.
- The implementation-gap inventory, product metrics, and reliability work.

### Modify

- **Checkpoint success criteria:** completion is not merely confidence-qualified discovery or snapshot confirmation; it must result in an actionable next move tied to a consequential uncertainty.
- **Delivery priority:** close the end-to-end learning loop before expanding isolated product surfaces. Reliability and observability remain first-class work because the loop cannot be trusted without them.
- **Test-plan emphasis:** retain the current unit and integration coverage, but add a product-level golden-path test that proves actionability, evidence handling, review boundaries, belief updates, and replanning.

### Add

- One explicit golden-path integration scenario.
- Actionability-based checkpoint criteria.
- An assumption → experiment → evidence → review → replan lifecycle.
- “Materially different next recommendation” as a required pass condition.

## Section scorecard

| Area from the initial prompt | Score | Current evidence | Main gap |
|---|---:|---|---|
| Conversation and recommendation architecture | 75% | Durable plans, ordered plan items, consumed/skipped statuses, context packets, background jobs, retry state, idempotency keys, persisted founder and assistant turns | The visible response still waits for the synchronous cofounder model call; concurrent client submission ordering and queue behavior need stronger integration coverage |
| Cofounder personality and hidden modes | 70% | Warm prompt contract, seven inferred modes, mode unit tests, one-question discovery planner | No behavioral evaluation harness, mode-specific guardrails, or product telemetry proving the tone works for founders |
| Natural checkpoint and naming | 75% | Readiness planner, naming plan item, snapshot synthesis, founder confirmation, name suggestion, recovery of missing context | Naming is still a transition into a review page rather than a fully continuous brainstorming flow; naming behavior needs end-to-end coverage |
| Company memory redesign | 65% | Canonical `memory_items` table with aspect, classification, confidence, evidence status, review state, provenance, and supersession fields; grouped memory UI | Contradictions, stale claims, inline memory-item correction, source documents, and review workflows are incomplete |
| First-dollar roadmap | 55% | Four visible milestone slots, hidden roadmap nodes, roadmap edges, milestone expansion data | Selection is not yet deterministic by dependency, risk, effort, and first-dollar relevance; evidence and software-build nodes are not fully generated |
| Continued chat and guided execution | 50% | Topic sessions, shared project context, task/experiment chat prefill, basic completion parsing, change-set review | No complete execution workspace, artifact/research flow, source-confirmation workflow, linked context model, or ambiguity-safe completion state |
| **Weighted implementation estimate** | **65%** | Strong persistence and orchestration foundation across all six areas | Remaining work is concentrated in product depth and outcome measurement |

### Scoring method

Each area was scored against the behavior requested in the initial prompt, not against the number of files or tables present. Infrastructure that exists without a complete user-facing flow is counted as partial implementation. The score is a directional engineering estimate and should be replaced by product telemetry once the analytics layer exists.

## Original test-plan coverage

The initial prompt listed 14 test themes. Current evidence maps to them as follows:

| Test theme | Status | Evidence or limitation |
|---|---|---|
| Multiple recommendations with stable ordering | Implemented | `cofounder_planner.js`, `recommendation_planner.js`, and planner tests cover ordered plan generation and deterministic ranking |
| A founder message consumes or skips a preplanned question | Partial | Plan items have `consumed` and `skipped` states and the response contract returns consumed/skipped IDs; a dedicated end-to-end founder-message scenario is still needed |
| Chat response persists when extraction fails | Implemented | Conversation-loop tests cover malformed, contract-invalid, and model-failure responses after founder persistence |
| Retry-safe jobs and duplicate prevention | Implemented | `background_jobs` has retry state and unique idempotency keys; proposal idempotency is tested |
| Discovery tone and hidden personality mode | Partial | Mode inference and warm prompts are unit-tested; there is no qualitative or model-evaluation suite |
| Checkpoint readiness does not prematurely block chat | Implemented | Discovery readiness remains separate from checkpoint review and readiness is based on confidence-qualified core facts |
| Naming suggestions never become company truth automatically | Implemented | Suggestions and `name_candidate` metadata remain separate from confirmed project data |
| Snapshot confirmation promotes facts into project memory | Implemented | Checkpoint confirmation and onboarding persistence are covered by integration tests |
| Confidence, provenance, correction, and supersession | Partial | Confidence, source turns, review state, and supersession schema exist; correction and supersession are not fully exposed in the memory UI |
| Four visible roadmap milestones backed by hidden nodes | Partial | Four visible slots and hidden graph nodes exist; dependency selection and complete supporting node coverage are incomplete |
| Software-product build tasks appear when needed | Missing | The roadmap schema allows `build`, but the current materializer does not generate software-build nodes from the selected first-dollar offer |
| Topic chats share memory without mixing histories | Partial | Topic sessions and project-scoped context exist; a dedicated cross-session isolation test is still needed |
| Completion messages produce evidence and operational updates | Partial | Task and experiment completion patterns exist; evidence extraction and changed-belief handling are not complete |
| Ambiguous completion remains pending | Missing | Current regular-expression matches can update a task or experiment without a dedicated ambiguity or founder-review state |
| Guided artifacts retain source links and approval boundaries | Missing | Artifact storage exists in the base schema, but no guided-execution artifact workflow or source-confirmation UI is implemented |

Summary of the 14 themes:

- Implemented: 5
- Partial: 7
- Missing: 2
- Weighted test-theme coverage, counting partial as half: **61%**

This is lower than the 65% section score because the test themes emphasize the unfinished product behaviors more heavily than the infrastructure scorecard.

## Golden Path Product Test

This is the highest-value new integration scenario. It should run against the real conversation, planning, persistence, enrichment, review, and replanning boundaries rather than testing each component in isolation.

### Scenario

**Given** a founder enters a vague startup idea, First Dollar should:

1. Ask focused questions and reach an actionable checkpoint.
2. Identify at least one consequential uncertainty that blocks or materially affects the next decision.
3. Create a linked experiment, task, or research plan with an explicit expected learning and completion signal.
4. Accept a founder-reported result, including evidence and an outcome that may contradict the current belief.
5. Extract and persist the evidence without losing the founder’s chat response if enrichment fails or is delayed.
6. Hold interpretation and material memory changes for founder review.
7. Apply only approved belief changes to canonical memory and roadmap state.
8. Replan from the approved evidence.
9. Produce a **materially different next recommendation** that reflects the changed belief or uncertainty state.

### Required pass conditions

The scenario passes only when all of the following are true:

- The checkpoint can formulate a credible, testable next-action candidate. That single candidate contains a primary consequential uncertainty or assumption, a prioritized action, a named owner (the founder or a specified participant), expected evidence, and an observable completion boundary.
- Actionability is assessed on the coherence of the proposed candidate; it is not satisfied by independently populating four discovery fields or by producing a generic “keep exploring” recommendation.
- The experiment or task is linked back to the assumption it is intended to test and forward to the evidence it produces.
- Founder-reported results are durable even when extraction, enrichment, or replanning is retried.
- Uncertain, conflicting, or ambiguous results remain pending review rather than silently changing task, experiment, memory, or roadmap state.
- Review shows the proposed interpretation and affected beliefs before they become canonical.
- Approval changes the relevant memory, assumption, experiment, or roadmap state with provenance.
- The post-review recommendation differs materially from the pre-experiment recommendation in action, priority, target, belief, or milestone—not merely in wording.
- A failed or inconclusive experiment can also pass if it produces a reviewed update and a justified replan; success is learning quality, not a positive result.

## Actionability-based checkpoint criteria

The existing readiness threshold remains useful as a discovery signal, but it is not sufficient for product completion. A checkpoint is successful only when the system can formulate a credible, testable next action from the available understanding. Actionability is a property of that proposed action candidate, not a second checklist of independent discovery requirements.

### Discovery readiness

- Core discovery facts meet the existing confidence threshold.
- The founder can review and correct the snapshot.
- Open gaps and unresolved contradictions remain visible.

### Actionability readiness

Ask one question: **Can I formulate a credible, testable next action?**

If yes, the proposed action internally carries the properties needed to execute and learn from it:

- one primary consequential uncertainty or assumption it is intended to reduce or test;
- a prioritized move that can be started now;
- an owner;
- expected evidence and an interpretation question;
- an observable completion boundary and a defined shape for the founder’s completion report; and
- a review boundary before material belief or roadmap changes are applied.

These are properties of one coherent action candidate. They should not be treated as separate discovery gates that block the checkpoint when the system can already formulate a credible action from the combined context.

Naming or snapshot confirmation alone should not count as a successful product checkpoint. The checkpoint may still be useful as an intermediate UI state, but the completion metric should count only an actionable checkpoint that can initiate the lifecycle below.

## Assumption → experiment → evidence → review → replan lifecycle

The product loop should make this state transition explicit:

1. **Assumption:** record the belief or uncertainty, its confidence, why it matters, and what decision it affects.
2. **Experiment:** create a linked action with an owner, scope, expected learning, success or disconfirmation signals, and completion boundary.
3. **Evidence:** accept the founder’s report and supporting details; preserve the raw report and provenance even if extraction is incomplete.
4. **Review:** present extracted evidence, proposed interpretation, contradictions, and candidate belief changes for founder approval. Ambiguity remains pending.
5. **Replan:** apply approved changes, update affected memory and roadmap nodes, and generate the next recommendation from the new state.

The lifecycle is incomplete if evidence is stored without interpretation review, if review does not affect canonical state, or if replanning returns the same recommendation when the approved belief state should change. The golden-path test should assert each transition and its durable links.

## Revised test-plan emphasis

The existing 14 test themes and their current status remain the baseline. New work should emphasize cross-boundary behavior in this order. The golden-path test should be created as an executable skeleton in Phase 0, then progressively made more complete and more passing as the product lifecycle is implemented:

1. **Phase 0 — test skeleton:** define the deterministic vague-idea fixture, positive/negative/inconclusive result variants, durable-link assertions, review boundaries, and the before/after recommendation comparison. The skeleton may initially expose expected failures, but it must run and make the missing product behavior visible.
2. **First green slice — actionable checkpoint:** make the vague idea reach a prioritized, linked, evidence-producing next move.
3. **Second green slice — evidence and review:** make founder-reported results durable, ambiguity-safe, and reviewable without silently mutating canonical state.
4. **Third green slice — belief update and replan:** make approved evidence update the relevant state and produce a materially different next recommendation.
5. **Hardening slice — reliability:** verify response persistence, retries, idempotency, concurrent submissions, and delayed or failed enrichment preserve the same links and outcome across the full lifecycle.

Component tests should continue to support these behaviors, but coverage should be reported separately for “component correctness” and “golden-path product completion.” A passing planner unit test must not be treated as proof that the founder can complete the loop.

## What is currently complete

### Conversation foundation

The repository has a real persistence boundary for the cofounder loop. A founder turn is stored with a project, session, turn number, context packet, and assistant response. The response includes a persisted recommendation and background-processing status. The `cofounder_plans` and `cofounder_plan_items` tables support multiple planned next moves rather than a single recommendation row.

The enrichment worker can restore missing context for older conversation rows, extract discovery facts, save canonical memory items, refresh the plan, and retry queued jobs. This directly addresses the requirement that extraction failure must not remove the already-saved conversation.

### Discovery and checkpoint

Discovery is modeled as a set of confidence-qualified fields rather than an intake questionnaire. The planner ranks gaps for customer, problem, context, workaround, outcome, solution, buyer, and first-dollar offer. The checkpoint requires the core discovery fields to be medium or high confidence.

The snapshot flow separates founder-stated fields from AI-organized fields, requires review of AI-organized content, keeps company naming founder-controlled, and exposes open gaps as a side rail. Recovery logic can rebuild missing discovery context from persisted turns after database rows have been cleared.

### Memory foundation

The `memory_items` layer is materially closer to a canonical source of truth than the previous `discovery_facts`-only model. It stores:

- Company aspect
- Statement or structured value
- Classification
- Confidence
- Evidence status
- Review state
- Source turn and document IDs
- Related entities
- Current or superseded status

The current UI groups memory by aspect and shows classification, confidence, and review state. Historical conversation excerpts are now hidden behind an explicit expand control instead of exposing raw IDs in the default view.

### Roadmap foundation

The schema supports visible milestones, hidden nodes, node types, status, metadata, and dependency edges. The API exposes a roadmap graph. The materializer guarantees four visible milestone slots and creates hidden nodes for assumptions, experiments, and tasks.

This is a useful foundation, but it is not yet the complete deterministic first-dollar graph described in the prompt.

## Main implementation gaps

### 1. Fast response behavior needs actual latency measurement

The response path persists the founder message and avoids waiting for background extraction, but it still awaits the synchronous cofounder model call before returning the assistant message. The architecture is asynchronous for enrichment, not fully asynchronous for response generation.

Required next work:

- Add server timing for founder persistence, context assembly, model response, assistant persistence, and total response time.
- Add p50 and p95 response latency dashboards.
- Add a client request sequence or session lock that proves concurrent submissions preserve order.
- Add an integration test where two founder messages arrive concurrently.

### 2. Naming should remain in the conversation loop

The planner can produce a `checkpoint_name_company` item and the enrichment worker can recognize a name response. The current UI still relies on a checkpoint action that opens the review view, so the naming experience is not yet a natural multi-turn brainstorming loop with founder selection in the same conversation.

Required next work:

- Persist naming suggestions as temporary session state, not project truth.
- Let the cofounder offer several naming directions and explain the rationale in chat.
- Persist only an explicit founder selection.
- Add an end-to-end test for “AI asks for name → founder brainstorms → founder selects → snapshot review.”

### 3. Memory needs correction and contradiction workflows

The schema supports review state and supersession, but the memory UI primarily displays records. It does not yet provide a complete “this is wrong,” contradiction resolution, stale-claim treatment, or memory-item edit flow with provenance-preserving replacement.

Required next work:

- Add memory-item correction and supersession endpoints.
- Create change sets for material corrections.
- Show contradictions and unresolved gaps as first-class memory states.
- Add review history and source navigation without exposing internal IDs.

### 4. Roadmap generation is structurally present but semantically shallow

The current graph attaches hidden operational records to milestones when they share an assumption. It does not yet select the visible four using the required deterministic criteria:

- Dependency order
- First-dollar relevance
- Unresolved risk
- Founder effort
- Unlocking later work

It also does not generate software-build tasks only when the selected offer requires software.

Required next work:

- Define a typed dependency graph with explicit edge direction and node prerequisites.
- Generate evidence and build nodes where applicable.
- Rank candidate milestones using a documented deterministic scoring function.
- Derive milestone progress from supporting node state.
- Add a software and non-software fixture to the roadmap tests.

### 5. Guided execution needs to become a product surface

The current “continue in chat” action produces a useful prefilled message for tasks, and the enrichment worker recognizes a narrow completion phrase for tasks and experiments. This is a good first bridge, but it is not yet guided execution.

Missing product capabilities include:

- Interview scripts and outreach templates
- Prospect or organization research with sources
- Research plans and checklists
- Product decision frameworks
- Draft artifacts linked to their originating task or experiment
- Founder approval before saving external research or material evidence
- Explicit handling for ambiguous or conflicting completion reports

## Product metrics to instrument next

The repository currently has test coverage but no outcome instrumentation. These metrics should be added before evaluating whether the product loop is working.

| Metric | Definition | Why it matters | Initial target |
|---|---|---|---:|
| First response latency | Time from founder send to assistant turn visible | Measures chatbot feel | p95 < 4 seconds |
| Background enrichment latency | Time from founder turn persistence to enrichment completion | Measures memory freshness | p95 < 30 seconds |
| Enrichment success rate | Completed enrichment jobs / queued enrichment jobs | Measures reliability of memory updates | > 98% |
| Recommendation queue consumption | Consumed or skipped plan items / presented plan items | Measures whether planning helps rather than creates clutter | > 70% |
| Repeated-question rate | Questions asked for fields already answered with high confidence | Measures context quality | < 5% |
| Discovery completion rate | Projects reaching checkpoint readiness / projects starting discovery | Measures whether the first loop completes | Establish baseline, then improve monthly |
| Naming transition rate | Snapshot review sessions reached after naming prompt | Measures checkpoint continuity | > 85% |
| Snapshot confirmation rate | Confirmed snapshots / snapshot review sessions | Measures trust and usefulness of the review UI | > 60% |
| Actionable checkpoint rate | Checkpoints that produce a prioritized, linked evidence-producing next move / checkpoint-ready projects | Measures whether a checkpoint starts learning rather than ending discovery | Establish baseline, then improve monthly |
| AI-organized correction rate | Fields edited or rejected / AI-organized fields shown | Measures extraction quality | Track by field and model version |
| Memory contradiction rate | New facts that contradict current memory / extracted facts | Measures memory integrity | Declining over time |
| Guided execution adoption | Recommended tasks opened in chat or guided execution / recommended tasks | Measures usefulness of recommendations | > 50% |
| Completion evidence capture | Task/experiment completions with an evidence-bearing founder report | Measures operational truth quality | > 80% |
| Materially different replan rate | Approved belief changes followed by a materially changed next recommendation when the affected decision requires one | Measures whether evidence changes the operating loop rather than only the record | 100% in qualifying cases |
| Ambiguous completion deflection | Ambiguous reports held for review / ambiguous reports detected | Prevents silent state corruption | 100% held for review |
| First-dollar progress | Supporting roadmap nodes completed before first payment | Measures the product’s core outcome | Track cohort median |

## Recommended delivery order

### Phase 0: Create the executable golden-path test skeleton

- Add a deterministic fixture in which a founder starts with a vague startup idea.
- Exercise the complete intended journey: checkpoint, consequential uncertainty, linked experiment, founder result, evidence extraction, review, approved belief change, replan, and materially different next recommendation.
- Include positive, negative, and inconclusive result variants so the contract covers learning rather than only success.
- Assert durable links between each lifecycle state and compare recommendation meaning before and after the reviewed result.
- Mark unimplemented assertions as explicit expected failures or staged gates; do not remove them to obtain a green test run.

### Priority 1: Progressively make the golden path pass

- First make checkpoint completion depend on actionability, not only discovery or snapshot readiness.
- Then make linked experiment/task creation and evidence-bearing founder reports pass.
- Then replace regex-only completion detection with structured intent extraction plus an ambiguity state.
- Then ensure every material status change has a founder-review path and provenance.
- Finally make approved belief changes update canonical state and produce a materially different next recommendation.
- Add latency, job, plan-item, checkpoint, evidence, review, and replan events as each stage becomes observable.
- Add concurrent submission ordering tests and retry/idempotency coverage as lifecycle stages become operational.

### Priority 2: Make reviewed evidence trustworthy in memory

- Add inline correction and supersession.
- Add contradiction and stale-claim panels.
- Link source excerpts to the originating chat without displaying raw IDs.
- Add tests for correction, supersession, and deleted-source recovery.

The reliability work in this priority is part of the product behavior: evidence must remain recoverable, attributable, and reviewable across retries and delayed enrichment.

### Priority 3: Replan the first-dollar graph from evidence

- Implement deterministic visible-milestone selection.
- Add explicit dependency edges.
- Generate evidence and conditional software-build nodes.
- Derive progress from hidden node state.
- Verify that approved belief changes alter affected priorities and next recommendations.

### Priority 4: Expand guided execution around the lifecycle

- Add linked task/experiment chat sessions.
- Add reusable interview, outreach, research, and product-decision templates.
- Add artifact drafts with source links and approval state.
- Add founder confirmation before material evidence or external research becomes memory.

### Priority 5: Validate the personality with real conversations

- Create a small evaluation set covering discovery, challenge, evidence interpretation, product design, execution, and naming.
- Score warmth, specificity, one-question discipline, repetition, unsupported claims, and useful next-step quality.
- Compare results with the product metrics above rather than relying on prompt inspection alone.

## Bottom line

The repository has crossed the architectural threshold for a conversation-first cofounder. It is no longer only an intake form or a flat recommendation engine. Completion should now be judged by whether a founder can move from vague idea to actionable uncertainty, produce and review evidence, and receive a materially updated next recommendation. The next phase should therefore close that user-facing loop while preserving the existing focus on fast responses, trustworthy memory correction, a semantically correct first-dollar graph, and founder-controlled execution.
