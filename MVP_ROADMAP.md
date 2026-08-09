# MVP Roadmap: Conversational AI Cofounder

## Target MVP

A founder creates a project and chats naturally with an AI. The AI gradually builds a versioned model of the startup, distinguishes assumptions from evidence, identifies the single most important unresolved issue, and drives the founder toward one of four states:

- **Question:** one focused question the founder can answer now.
- **Task:** one concrete action the founder should do next.
- **Experiment:** one bounded test of a critical assumption.
- **Wait:** a deliberate pause while the founder collects or awaits evidence.

When the founder returns with results, the AI updates its beliefs, preserves provenance and prior versions, recalculates the top unresolved issue, and determines the next state.

## Current State

The project is a small Node/Postgres app with a browser UI.

Already implemented:

- Project creation and AI-assisted onboarding draft flow.
- Persistent Postgres-backed project memory.
- CRUD APIs for projects, assumptions, evidence, experiments, tasks, and decisions.
- Links between assumptions, evidence, experiments, and tasks.
- Roadmap milestones generated after onboarding.
- Event log audit trail for material actions.
- Frontend views for Today, Roadmap, Memory, Assumptions, Evidence, Experiments, and Tasks.
- Tests covering onboarding normalization, strict AI schemas, API mutation/audit behavior, and plan generation.

Key gap:

- The app has AI-assisted onboarding and plan generation, but not the ongoing conversational cofounder loop. Current records are mostly mutable rows, not a versioned belief system with pending AI change sets, recommendations, or conversation state.

## MVP Principles

1. Ship the loop before the perfect knowledge graph.
2. Keep the database as the source of truth; the LLM proposes structured changes.
3. Never let AI silently convert an assumption into evidence or fact.
4. Require provenance for every material belief update.
5. Show one recommended next state, not a pile of suggestions.
6. Preserve history for beliefs and recommendations, even if the UI initially shows only the current view.

## Phase 1: Define The MVP Contract

### Goal

Turn the product idea into a narrow executable contract that backend, frontend, and LLM behavior can share.

### Work

- Create an `ai_cofounder_contract.js` module defining:
  - Allowed next states: `question`, `task`, `experiment`, `wait`.
  - Belief classifications: `unknown`, `founder_statement`, `assumption`, `hypothesis`, `evidence_observation`, `finding`, `decision`.
  - Evidence relationships: `supports`, `contradicts`, `mixed`, `neutral`.
  - Recommendation fields: `state`, `primary_issue`, `reason`, `action_payload`, `confidence`, `source_ids`.
- Convert the strongest rules from `AI_Cofounder_Operating_Manual_Outline.md` into a compact system prompt:
  - Optimize for progress toward first revenue.
  - Ask one question at a time.
  - Prefer behavior and payment evidence over opinions.
  - Update confidence only from evidence or founder-confirmed facts.
  - Produce a structured proposal, not direct writes.
- Define JSON schemas for AI outputs:
  - `assistant_message`
  - `proposed_belief_updates`
  - `proposed_records`
  - `recommendation`
  - `needs_founder_review`

### Acceptance Criteria

- A single internal contract describes what the LLM can return.
- Tests assert that invalid next states, missing provenance, and unsupported record types are rejected.

## Phase 2: Add Conversation Persistence

### Goal

Store every chat turn and connect it to the project state used by the AI.

### Work

- Add migration `003_conversation_loop.sql`.
- Create tables:
  - `conversation_sessions`
  - `conversation_turns`
  - `context_packets`
  - `recommendations`
- Store:
  - Founder message.
  - AI response.
  - Model name.
  - Prompt version.
  - IDs of memory records included in context.
  - Structured extraction/proposal payload.
  - Current recommendation.
- Add backend routes:
  - `GET /api/projects/:projectId/chat`
  - `POST /api/projects/:projectId/chat`
  - `GET /api/projects/:projectId/recommendation`

### Acceptance Criteria

- A founder can send a message and receive a persisted assistant reply.
- Reloading the page preserves chat history.
- Each AI turn records the context packet used to generate it.

## Phase 3: Build The Deterministic Context Builder

### Goal

Give the AI enough memory to reason well without dumping the whole database every turn.

### Work

- Add `context.js`.
- Build a project context packet containing:
  - Project snapshot.
  - Current first-dollar path.
  - Top assumptions by risk score.
  - Recent evidence.
  - Active or proposed experiments.
  - Open tasks.
  - Latest decision records.
  - Latest recommendation.
  - Recent conversation turns.
- Add deterministic issue scoring:
  - Importance.
  - Uncertainty.
  - Evidence quality.
  - Revenue proximity.
  - Dependency/blocker status.
  - Existing active work.
- Compute a `top_unresolved_issue` before calling the LLM.

### Acceptance Criteria

- Context builder can be unit tested without OpenAI.
- The selected top issue is stable and explainable.
- If there is an active task or experiment, the AI sees that before proposing new work.

## Phase 4: Introduce Versioned Beliefs

### Goal

Move from mutable assumptions toward a minimal versioned model of startup beliefs.

### Work

- Add tables:
  - `beliefs`
  - `belief_versions`
  - `belief_evidence_links`
- Keep existing `assumptions` for compatibility during MVP, but project important assumptions into `beliefs`.
- Each belief version should include:
  - Statement.
  - Classification.
  - Validation status.
  - Confidence.
  - Importance.
  - Scope JSON.
  - Rationale.
  - Created from turn/event/source.
- Add service functions:
  - `createBeliefFromAssumption`
  - `appendBeliefVersion`
  - `linkEvidenceToBeliefVersion`
  - `currentBeliefsForProject`
- Update onboarding confirmation to create initial belief records for accepted assumptions.

### Acceptance Criteria

- Editing or reclassifying a material belief appends a new version.
- Prior versions remain queryable.
- Evidence links point to a specific belief version, not only a mutable assumption.

## Phase 5: Add AI Change Sets

### Goal

Ensure the AI proposes state changes and the founder approves them before they become company memory.

### Work

- Add tables:
  - `change_sets`
  - `change_set_items`
- Implement `proposeChangeSet(projectId, aiPayload)`:
  - Validates JSON schema.
  - Requires source turn ID.
  - Requires provenance for material changes.
  - Rejects evidence-free upgrades from assumption to finding/fact.
  - Rejects tasks or experiments not tied to the top issue unless explicitly justified.
- Implement founder actions:
  - Approve all.
  - Approve selected.
  - Reject.
  - Edit then approve.
- Apply approved change sets in one DB transaction.

### Acceptance Criteria

- The AI cannot directly mutate beliefs, tasks, experiments, evidence, or decisions from chat.
- Approved change sets create audit events.
- Rejected change sets remain recorded.

## Phase 6: Implement The Chat Orchestrator

### Goal

Make the ongoing AI loop work end to end.

### Work

- Add `cofounder.js` with:
  - `handleFounderMessage(projectId, userId, message)`
  - `buildContextPacket`
  - `callCofounderModel`
  - `normalizeCofounderOutput`
  - `proposeChangeSet`
  - `persistConversationTurn`
- Prompt the model to return:
  - A natural founder-facing message.
  - One next state.
  - One primary unresolved issue.
  - Any proposed structured updates.
  - Whether founder approval is required.
- Handle four core flows:
  - Founder answers a question.
  - Founder reports task completion.
  - Founder reports experiment results.
  - Founder adds new evidence from a conversation, metric, or payment.

### Acceptance Criteria

- A founder can return with results and the AI updates the recommendation.
- The AI response contains exactly one next state.
- Structured updates are proposed as a change set when material.
- No chat turn is lost if the model call succeeds but change-set validation fails.

## Phase 7: Add The Chat UI

### Goal

Make chat the primary workflow while preserving the existing structured views.

### Work

- Add a `Chat` or `Cofounder` view to `index.html` and `app.js`.
- Show:
  - Conversation thread.
  - Current top unresolved issue.
  - Current recommended state.
  - Pending change set review panel.
  - Related assumptions/evidence/tasks/experiment chips.
- Add composer affordances:
  - Normal message input.
  - “I did this” completion affordance for active tasks.
  - “Add evidence” quick capture.
  - “Record experiment result” quick capture.
- Update Today view to link into the active chat/recommendation instead of only showing the highest-priority task.

### Acceptance Criteria

- First screen after project creation can continue naturally in chat.
- Pending AI updates are visible before approval.
- The founder can approve/reject proposed updates without leaving the conversation.

## Phase 8: Recommendation Engine V1

### Goal

Make the AI consistently decide what should happen next.

### Work

- Implement deterministic pre-ranking of unresolved issues.
- Let the LLM explain and shape the next move, but not invent the priority from scratch.
- Recommendation rules:
  - If the top issue can be resolved by founder knowledge, choose `question`.
  - If the next step is known and low-risk, choose `task`.
  - If a critical assumption needs outside-world evidence, choose `experiment`.
  - If an experiment/task is already running and no new input exists, choose `wait`.
- Persist every recommendation with:
  - Issue ID or issue text.
  - State.
  - Explanation.
  - Source context packet.
  - Supersession relationship to previous recommendation.

### Acceptance Criteria

- The app always has one current recommendation per active project.
- Completing a task or adding evidence recalculates the recommendation.
- Repeated “new task” spam is prevented when a task/experiment is already active.

## Phase 9: Result Intake And Belief Updating

### Goal

Make return visits meaningful: the founder reports what happened, and the AI updates beliefs.

### Work

- Add result-specific schemas:
  - Customer interview result.
  - Outreach result.
  - Landing page result.
  - Payment/commitment result.
  - Experiment checkpoint/final result.
- Add evidence extraction from founder messages:
  - Source title.
  - Source type.
  - Summary.
  - Raw excerpt when provided.
  - Signal type: opinion, stated intent, behavior, payment.
  - Evidence strength.
- Update belief confidence/status using bounded rules:
  - One vague positive interview cannot validate willingness to pay.
  - Payment/contract evidence can strongly support a scoped willingness-to-pay belief.
  - Contradictory evidence produces `mixed` or `contradicted`, not deletion.
- Mark tasks/experiments complete only when completion evidence exists.

### Acceptance Criteria

- “I talked to 5 bookkeepers and 3 said they would pay $300” creates evidence and proposes belief updates.
- “Someone paid” is captured as stronger evidence than “someone liked it.”
- The previous belief version remains visible after an update.

## Phase 10: MVP Hardening

### Goal

Make the loop reliable enough for repeated founder use.

### Work

- Add integration tests for:
  - Chat turn persistence.
  - Change set approval.
  - Belief version append.
  - Evidence-linked confidence update.
  - Recommendation state transitions.
- Add model failure handling:
  - Preserve founder message.
  - Show retryable failure.
  - Do not write partial state.
- Add request limits and payload caps for chat.
- Add basic prompt/model versioning.
- Add seed data for a chat-ready sample project.
- Update README with setup and MVP behavior.

### Acceptance Criteria

- `npm test` covers the core conversational loop without requiring a live OpenAI call.
- Local startup still requires server-side `DATABASE_URL` and `OPENAI_API_KEY`.
- Manual QA can complete: create project, chat, approve update, complete task, add result, receive new recommendation.

## Suggested Implementation Order

1. Add contract/schema tests first.
2. Add conversation tables and routes.
3. Add context builder.
4. Add chat orchestrator with mocked model tests.
5. Add change sets.
6. Add minimal belief versioning.
7. Add frontend chat and review panel.
8. Wire result intake and recommendation recalculation.
9. Expand tests and seed data.

## MVP Cut Line

Include:

- One project per local founder.
- Natural chat.
- Persisted conversation history.
- Versioned beliefs for key assumptions.
- Evidence-backed updates.
- Pending AI change sets.
- One current recommendation.
- Four next states: question, task, experiment, wait.
- Founder approval before material AI writes.

Defer:

- Multi-user authorization.
- Full Supabase Auth/RLS.
- Full claim graph from `AI_Cofounder_Schema_and_LLM_Tools.md`.
- External integrations.
- Revenue provider integration.
- Advanced retrieval/vector search.
- Automated background agents.
- Complex dashboards.

## Definition Of Done

The MVP is done when a founder can:

1. Create a project from a messy idea.
2. Chat with the AI about what they know.
3. See the AI identify the most important unresolved issue.
4. Receive exactly one next question, task, experiment, or wait recommendation.
5. Return with real-world results.
6. Review and approve the AI's proposed memory updates.
7. See assumptions, evidence, belief versions, tasks, experiments, and recommendations update accordingly.
8. Continue the loop without re-explaining the startup.
