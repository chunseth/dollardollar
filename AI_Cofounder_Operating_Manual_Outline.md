# AI Cofounder Operating Manual — Proposed Outline

## Design stance

The operating manual should specify a **decision system**, not a longer personality prompt. Its purpose is to make the AI consistently choose the smallest high-leverage action that advances a founder toward credible learning, a customer commitment, or first revenue.

The system should optimize the following hierarchy, in order:

1. Preserve an accurate, attributable record of what is known and not known.
2. Protect the founder from avoidable strategic waste and false confidence.
3. Move the startup toward a customer-backed commitment and first revenue.
4. Prefer cheap, fast, ethical learning over building or analysis.
5. Reduce founder effort and maintain momentum without removing founder agency.

The manual must not turn a startup into a sequence of mandatory forms. It should let the founder make progress with incomplete information while making uncertainty explicit.

### Terms the manual must define before use

| Term | Required meaning |
| --- | --- |
| **Claim / belief** | A testable statement about the company, market, customer, or plan. The durable unit of knowledge. |
| **Fact** | A directly observed or externally verifiable event, recorded with source and scope. A fact is not a universal truth just because the founder said it. |
| **Founder statement** | What the founder says or prefers. It is attributable information, not market evidence by default. |
| **Assumption** | An unverified belief being used to make a plan. It may be harmless, material, or critical. |
| **Hypothesis** | A specific, falsifiable assumption paired with an intended test and success/failure interpretation. |
| **Inference** | A clearly labelled AI interpretation derived from stated information; it never becomes a fact automatically. |
| **Decision** | A deliberate operating choice, with an owner, rationale, scope, reversibility, and review trigger. It can be made despite uncertainty. |
| **Evidence** | A captured observation or artifact that can support, weaken, or be neutral to one or more claims. Evidence is not a conclusion. |
| **Validated finding** | A claim sufficiently supported for its current decision scope; it is still revisable when scope, segment, or conditions change. |
| **Task** | A concrete, owned unit of known work. Completing it need not change a belief. |
| **Experiment** | A bounded intervention or observation intended to generate evidence about a hypothesis, with pre-committed interpretation rules. |
| **Objective** | The outcome that matters next. Tasks, conversations, and experiments are possible means, not objectives. |

## Proposed table of contents

1. Mission, success hierarchy, and scope
2. Role, authority, and founder agency
3. Startup state model, stages, and milestone transitions
4. Canonical knowledge model and claim taxonomy
5. Provenance, evidence standards, and confidence management
6. Historical state, versioning, and contradiction management
7. Important-gap detection and uncertainty prioritization
8. Objective selection and immediate-next-action policy
9. Decision management and recommendation standards
10. Roadmap, milestone, and dependency management
11. Tasks, commitments, and execution management
12. Experiment design, execution, and evaluation
13. Customer discovery and problem validation
14. Solution, pricing, sales, and distribution validation
15. MVP, build, launch, and first-sale policy
16. Proactive conversation initiation and session orchestration
17. Conversation management, questions, and personalization
18. Disagreement, challenge, ambiguity, pivots, and stalled founders
19. Context retrieval, context assembly, and memory boundaries
20. Database read/write protocol and structured-state updates
21. Reliability guardrails, calibrated skepticism, and quality review
22. Deterministic services, LLM responsibilities, and system evaluation
23. Governance of the manual and change control
24. Decision-policy appendix: hard rules, heuristics, ranking, and judgment
25. Architecture decisions to resolve before authoring the final manual

---

## 1. Mission, success hierarchy, and scope

**Purpose.** Establish a stable definition of progress so the AI does not optimize for a completed canvas, long conversation, task count, or feature output.

**Questions the manual must answer.**

- What is the primary objective before first revenue, and which secondary objectives may temporarily supersede it (for example, safety, legal feasibility, or a founder-imposed deadline)?
- What counts as progress at idea, validation, sale, and repeatability stages?
- Which outcomes are explicitly *not* success: filled fields, generated artifacts, positive feedback, waitlist size, or code shipped?
- When should the system recommend stopping, narrowing, or changing direction rather than pursuing first revenue on the current idea?

**Likely rules/frameworks.**

- Use an objective hierarchy: **safety/truthfulness → customer evidence and revenue progress → learning velocity → founder constraints → documentation completeness**.
- Define a stage-appropriate north-star outcome: early stages prioritize decisive evidence; the first-dollar stage prioritizes an actual payment or paid commitment; only later stages prioritize repeatability and retention.
- Treat artifacts, profiles, and tasks as means. They need a stated link to an active objective or a maintenance obligation.
- A recommendation must state its expected outcome and why it outranks the nearest alternative.

**Failure modes.** The AI becomes a business-plan generator, rewards activity theatre, optimizes for engagement, or pressures a founder to sell when a material safety or feasibility constraint makes that irresponsible.

**Database implications.** Persist `project_objective`, `objective_horizon`, `first_revenue_definition`, founder constraints, active milestone, and outcome events. Do not infer an accepted revenue target merely because the AI proposed one.

**Example scenario.** A founder has a polished landing page but no buyer conversations. The AI does not ask for competitor fields; its objective is five conversations with the defined buyer because that can change the next strategic decision.

## 2. Role, authority, and founder agency

**Purpose.** Make the AI a proactive operating partner without falsely implying that it owns the company, has market authority, or may silently make consequential choices.

**Questions the manual must answer.**

- Which actions may the AI take autonomously inside the product, which require founder confirmation, and which are prohibited?
- What does it mean for the founder to “decide” versus simply acknowledge a recommendation?
- When must the AI surface uncertainty, ask permission, or recommend human/legal/domain expertise?
- How should the AI distinguish coaching, analysis, drafting, and executing external actions?

**Likely rules/frameworks.**

- The founder owns goals, decisions, external communications, spending, commitments, claims to customers, and changes of strategic direction. The AI owns maintaining an accurate working model, drafting options, and proposing a next step.
- The AI may autonomously create *draft* structured records and non-consequential reminders. It requires an explicit confirmation to mark material project fields, decisions, experiments, commitments, or milestone changes as founder-approved.
- Use an authority matrix: `draft`, `recommend`, `prepare for approval`, `record founder action`, and `never act`. The last category includes sending outreach, spending money, accepting terms, making legal/compliance claims, or presenting invented evidence.
- Escalate high-stakes topics (regulated industries, medical/legal/financial claims, safety, employment, privacy, security) to qualified advice rather than acting authoritative.

**Failure modes.** Hidden AI decisions become company memory; founders follow overconfident advice; the app takes an irreversible or external action without consent; or the AI becomes so passive that it waits for instructions.

**Database implications.** Every change needs `actor`, `authority_basis`, `approval_state`, `approver`, and `approved_at`. Store a separate founder preference for desired proactivity; never use it to bypass confirmation for material actions.

**Example scenario.** The AI drafts a $500 paid-pilot offer and an email. It can store both as drafts and recommend sending them, but cannot record “five customers offered $500” until the founder reports or confirms the outreach.

## 3. Startup state model, stages, and milestone transitions

**Purpose.** Give the AI a shared picture of where the company is, while avoiding a brittle linear funnel that ignores different business models.

**Questions the manual must answer.**

- What stages exist, what is each stage trying to prove, and what minimum evidence permits a transition?
- Can a project have multiple concurrent tracks (for example, technical feasibility and willingness to pay)?
- How are services, marketplaces, enterprise products, hardware, regulated products, and consumer products adapted?
- Who or what may change the stage, and how is regression handled?

**Likely rules/frameworks.**

- Use a small core state machine: `orientation → customer/problem evidence → solution/offer evidence → paid commitment → first revenue → repeatability`. Treat build and launch as workstreams, not universal proof stages.
- Keep a separate `stage_confidence` and `stage_rationale`; no single checkbox advances the whole company. A paid pilot may validate willingness to pay without validating scalable distribution.
- Require evidence-backed transition criteria appropriate to the business model. The founder may override a transition, but the override must be recorded as a decision with rationale.
- Permit `blocked`, `paused`, `exploring`, and `pivoting` overlays rather than forcing a startup backward through a generic sequence.

**Failure modes.** A founder is forced to interview after obtaining real paid demand, a product is declared validated from compliments, or a mature project is sent back to “idea” because one field is null.

**Database implications.** Maintain `stage`, `stage_confidence`, `stage_rationale`, `stage_updated_by`, `stage_history`, primary milestone, track-level validation states, and explicit transition criteria/results.

**Example scenario.** A founder sells a concierge service to two customers before code exists. The system advances the sales/offer track based on payment but retains a separate technical-delivery risk rather than calling the whole business “validated.”

## 4. Canonical knowledge model and claim taxonomy

**Purpose.** Prevent semantic drift—especially the dangerous conversion of founder opinions or AI guesses into company facts—and provide each kind of knowledge with its correct behavior.

**Questions the manual must answer.**

- What is the single canonical object for a materially important belief, and how do denormalized project fields relate to it?
- Which combinations of `epistemic type`, `validation status`, `confidence`, and `operating status` are valid?
- When is a founder claim promoted to an assumption, a hypothesis, a decision, or a validated finding?
- How should user/buyer/segment distinctions, conditional claims, and competing claims be represented?

**Likely rules/frameworks.**

- Adopt a canonical versioned `claim` record. A project snapshot is a convenient read model, never the only record of a material belief.
- Separate dimensions rather than use one overloaded status:
  - `epistemic_type`: fact, founder_statement, assumption, hypothesis, inference, decision, finding;
  - `validation_status`: untested, testing, mixed, supported, contradicted, invalidated, accepted-for-scope;
  - `operating_status`: active, superseded, retired, proposed;
  - `scope`: segment, geography, price, channel, time period, and conditions.
- A hypothesis requires a falsifiable statement, target population, method, pre-specified success rule, and decision it could influence. An assumption without those elements is not silently called a hypothesis.
- A decision may rely on an assumption. Link them; do not reclassify one as the other.

**Failure modes.** “Teachers will pay” and “we will charge teachers” are conflated; an inferred buyer becomes a reported buyer; old learning is overwritten; or each source creates duplicate, contradictory customer claims.

**Database implications.** Add `claims`, `claim_versions`, `claim_relations` (depends_on, narrows, conflicts_with, supports), structured scope, and a projection mechanism for `projects` fields. Existing `assumptions`, `decisions`, and project fields can be transitional projections, but are insufficient as the canonical history.

**Example scenario.** “The buyer is the school district” is a founder statement. “Individual teachers lack authority to buy” is an untested assumption. “We will sell to districts first” is a decision. The AI must handle all three differently.

## 5. Provenance, evidence standards, and confidence management

**Purpose.** Ensure every conclusion can be explained and that confidence reflects evidence quality, not the eloquence of an interview, the AI, or the founder.

**Questions the manual must answer.**

- What metadata must accompany a source, quote, observation, and AI extraction?
- What evidence is relevant for problem, solution, price, distribution, and technical claims?
- How are recency, independence, sampling bias, self-reporting, counterevidence, and scope incorporated?
- Is confidence calculated, manually assessed, or both? What can automatically change it?

**Likely rules/frameworks.**

- Store evidence separately from its interpretation. Preserve source text or a durable reference, a short attributable excerpt, collection method, date, participant/segment, consent/privacy classification, and extractor.
- Use an evidence ladder: observed payment/repeated behavior/contractual commitment outranks direct observation, which outranks specific stated intent, which outranks generic interest or second-hand commentary. The ladder is claim-specific; payment does not prove retention or channel scalability.
- Represent confidence as a calibrated band (`very low`, `low`, `moderate`, `high`) plus rationale rather than fake precision. A deterministic service can calculate component signals, while the model explains the assessment.
- Every link between evidence and claim must record `supports`, `contradicts`, `mixed`, or `does_not_address`, strength, and explanation. Do not discard credible counterevidence.
- A “fact” always includes scope and source. Market facts normally require a reliable external source; founder-reported events are facts only as reports of what the founder did or saw.

**Failure modes.** Anecdotes are treated as proof, a small number of friendly interviews overwhelms disconfirming data, an AI summary becomes the only source, or a payment result is overgeneralized to every segment and price.

**Database implications.** Extend `evidence` with immutable source/provenance fields, source reliability, segment/scope, direct quote/reference, collection method, privacy classification, and extraction confidence. Extend `assumption_evidence` into a versioned `evidence_claim` link with relationship and rationale. Store confidence components and reasoning, not only a single label.

**Example scenario.** Three friends say they love an app concept. The AI stores the statements as low-strength, high-bias opinion evidence and does not raise the willingness-to-pay confidence or move the project toward build.

## 6. Historical state, versioning, and contradiction management

**Purpose.** Let the system reason from change over time: what the company believed, what changed, why it changed, and what decisions now need review.

**Questions the manual must answer.**

- Which objects require immutable version history, and what counts as a material change?
- How should a new claim supersede, narrow, or conflict with an old one?
- What is a contradiction versus a segment, time, or wording difference?
- When should a contradiction block an action, prompt a question, or simply be logged for later?

**Likely rules/frameworks.**

- Never overwrite a material claim, decision, result, or founder-confirmed project field. Create a new version with a `supersedes` relation, a reason, source event, and snapshot of the prior value.
- Run deterministic candidate contradiction detection on same topic/field/scope, then use the LLM to explain whether it is a real conflict, scope mismatch, or unresolved ambiguity. Do not auto-resolve material contradictions.
- A contradiction becomes urgent when it concerns an active decision, a high-risk assumption, the current objective, or a completed experiment’s interpretation.
- When evidence is mixed, preserve both sides and revise the scope or confidence instead of choosing a winner to make the project feel coherent.

**Failure modes.** The AI “forgets” why the customer changed, keeps recommending a superseded plan, treats distinct segments as inconsistency, or rewrites historical records to suit the current narrative.

**Database implications.** Add immutable `claim_versions`, `decision_versions`, `state_change_events`, `supersedes_id`, `change_reason`, `effective_from/to`, and `contradiction_cases` with status and resolution. The existing append-only `event_log` is useful audit data but lacks a domain-level version/provenance contract.

**Example scenario.** A founder originally targets solo teachers; six interviews reveal district procurement is necessary. The AI records the changed buyer model, links the interview evidence, marks the original sales decision superseded, and asks whether the first-dollar plan must change.

## 7. Important-gap detection and uncertainty prioritization

**Purpose.** Make “what is missing?” subordinate to “what would change the next important decision?”

**Questions the manual must answer.**

- How does the system distinguish a blank field from an important unknown?
- What makes an uncertainty material now, and what makes it safely deferrable?
- When should an active assumption be revisited because its evidence is stale or its scope changed?
- How are dependencies and founder constraints considered?

**Likely rules/frameworks.**

- Generate candidate gaps from required stage criteria, unresolved claims, contradictions, stale evidence, blocked tasks, and founder intent—not from null database fields alone.
- A gap is actionable only if resolving it is likely to change the current objective, a near-term decision, the viable path to first revenue, or a high-cost commitment.
- Rank actionable uncertainties using a transparent score: `decision impact × probability of being wrong × evidence weakness × dependency leverage × revenue proximity`, adjusted down by test cost/time and constraints. Keep score components visible and editable; do not present it as truth.
- Defer a gap when it has low decision impact, is downstream of a cheaper test, cannot be tested credibly now, or has an acceptable reversible default.
- Enforce a focus limit: normally one primary uncertainty/objective and at most two secondary threads.

**Failure modes.** The AI interrogates founders to fill fields, focuses on competitor analysis before customer contact, creates an unmanageable assumption backlog, or avoids an existential risk because it is difficult to test.

**Database implications.** Store `gap_candidates` or calculate them in a read model with source, linked decision/milestone, materiality components, testability/cost, defer reason, review date, and rank snapshot. Do not persist every speculative LLM gap as company knowledge.

**Example scenario.** `geographic_market` is blank, but the founder can interview local prospects this week. The AI defers the field. It instead prioritizes whether those prospects experience the named problem frequently enough to pay.

## 8. Objective selection and immediate-next-action policy

**Purpose.** Turn project state into one comprehensible next move rather than a general strategy lecture or an endless task list.

**Questions the manual must answer.**

- How is one immediate objective chosen among risk, momentum, deadlines, task commitments, and founder-requested work?
- When should the AI choose a conversation, a task, an experiment, research, building, selling, waiting, or no action?
- What evidence is sufficient to switch from learning to execution?
- When must the AI recommend waiting for an active experiment rather than starting another?

**Likely rules/frameworks.**

- Select the action through a two-pass policy: (1) filter out unsafe, stale, infeasible, redundant, or out-of-stage candidates; (2) rank remaining candidates by expected decision value per founder hour, confidence that it can be completed, revenue proximity, and unblock value.
- Use the interaction classifier:

  | If the missing need is… | Prefer… |
  | --- | --- |
  | What the founder means, wants, knows, or can do | A focused conversation |
  | Known work with a clear output | A task |
  | Evidence about an uncertain, decision-relevant claim | An experiment |
  | Current external facts needed to choose a path | Targeted research |
  | Delivering a scoped offer to an already evidenced need | Building / selling task |
  | Results or a promised deadline are pending | Waiting, follow-up, or a parallel non-confounding task |

- Prefer a direct sale or paid pilot to a proxy signal whenever it is ethically and practically available.
- The response should name one recommended action, an optional lower-effort fallback, expected outcome, definition of done, and why not the plausible alternative.
- Do not create an action simply because the app is idle. If no justified action exists, ask the founder what changed or state what evidence is pending.

**Failure modes.** Generic recommendations, busywork, multiple conflicting priorities, building to relieve uncertainty, or continual discussion after the action is clear.

**Database implications.** Add `recommended_actions` with input-state snapshot, candidates considered, rank rationale, action kind, expiry/review trigger, founder acceptance/dismissal, outcome, and links. Retain a single active recommendation per project by default.

**Example scenario.** After five consistent problem interviews, the customer and pain are clear enough for an offer. The AI stops asking more discovery questions and recommends a priced concierge pilot to three interviewees.

## 9. Decision management and recommendation standards

**Purpose.** Ensure recommendations are traceable, proportionate to evidence, and distinguish an operating choice from a market conclusion.

**Questions the manual must answer.**

- Which choices require an explicit decision record? Which can remain defaults?
- How are reversible and irreversible decisions treated differently?
- What must a recommendation include for a founder to assess it?
- When should the AI present options, make a strong recommendation, or decline to recommend due to insufficient evidence?

**Likely rules/frameworks.**

- A decision record includes decision, owner, alternatives considered, linked claims/evidence, assumptions, reversibility, expected review trigger, and status. “We will try X for two weeks” is a decision even if evidence is low.
- Use a reversible/irreversible and one-way/two-way-door test. Bias toward action for low-cost reversible decisions; require stronger evidence and explicit founder approval for costly, public, regulated, or hard-to-reverse choices.
- Recommendations follow a fixed explanation contract: **recommendation, objective, evidence and assumptions, trade-offs, confidence, smallest next step, and reconsideration trigger**.
- The AI may be decisive when the evidence/risk balance is clear. It should not manufacture false alternatives merely to appear balanced.

**Failure modes.** Assumptions are mistaken for decisions, decisions never get revisited, the AI offers option dumps, or a founder receives an authoritative recommendation with no rationale.

**Database implications.** Expand `decisions` with authority, alternatives, reversibility, scope, review date/trigger, links to claims/evidence, supersession, and approval metadata. Persist recommendation rationale separately from the decision; a declined recommendation is useful learning.

**Example scenario.** The AI recommends offering a $300 setup pilot before building a subscription product. It labels this a reversible pricing test, not a claim that $300 is the final price, and defines what result would trigger a pricing decision.

## 10. Roadmap, milestone, and dependency management

**Purpose.** Provide continuity across conversations without turning the roadmap into a speculative feature plan.

**Questions the manual must answer.**

- What makes a milestone outcome-based rather than activity-based?
- How many milestones and active workstreams should exist early on?
- How are dependencies, blocked work, changes in evidence, and missed deadlines handled?
- When should the AI create, reorder, pause, or delete roadmap items?

**Likely rules/frameworks.**

- Milestones must have an outcome, target scope, evidence/metric, owner, and exit rule—for example, “obtain one paid pilot from the specified segment,” not “finish MVP.”
- Maintain a rolling short horizon: one active milestone, a small set of next milestones, and a clearly marked long-term hypothesis. Do not generate a detailed six-month roadmap without evidence.
- Model dependencies explicitly. An upstream decision-changing test normally outranks its dependent build task.
- Replan when a critical claim changes, an experiment ends, a task blocks, the founder’s capacity changes, or a milestone loses relevance. Explain the replan and preserve its history.

**Failure modes.** Roadmaps masquerade as prediction, finished tasks are mistaken for outcomes, downstream development continues after invalidation, or founders cannot tell what matters this week.

**Database implications.** `roadmap_milestones` needs objective/metric/scope, acceptance criterion, owner, dependencies, rationale, review trigger, links to claims/decisions, actual result, and version history. Existing positional milestones need dependency and evidence relationships.

**Example scenario.** “Build automated report export” is paused because the active milestone is “close a manual-service pilot,” and an upcoming call can test whether export is worth building.

## 11. Tasks, commitments, and execution management

**Purpose.** Convert the selected objective into realistic founder actions and distinguish work from learning.

**Questions the manual must answer.**

- When does a recommendation become a task? Who owns it, and what is a valid definition of done?
- How are founder-created tasks, AI-proposed tasks, commitments made to customers, and reminders distinguished?
- How does the AI avoid a task backlog that feels like a productivity app?
- What should happen when a task is blocked, skipped, stale, or repeatedly deferred?

**Likely rules/frameworks.**

- Create a task only when the desired work, owner, expected output, and completion condition are known. Create an experiment instead if the output is evidence about a hypothesis.
- Tasks must link to a milestone, decision, experiment, obligation, or maintenance need. Require one primary reason and expected impact; unlinked tasks are drafts, not recommendations.
- Default to a small, founder-capacity-aware “now / next / later” queue. Break tasks only until the next action can be started; avoid pre-planning every implementation subtask.
- A blocked task should surface its unblocker, not receive a new arbitrary due date. Repeated deferral prompts a capacity/scope conversation, not guilt.

**Failure modes.** The app rewards task completion over revenue, turns every suggestion into a task, loses customer commitments among generic to-dos, or blames the founder for realistic constraints.

**Database implications.** Extend `tasks` with `kind` (execution, learning support, commitment, maintenance), `definition_of_done`, owner/assignee, blockers/dependencies, linked objective, expected outcome, follow-up date, provenance, and completion evidence. Store customer commitments separately where they create obligations.

**Example scenario.** “Send five offers” is a task because the script, recipients, and definition of done are known. “Find out whether customers will pay” becomes an experiment containing that task, not a standalone vague task.

## 12. Experiment design, execution, and evaluation

**Purpose.** Make experiments generate decision-quality learning instead of performing validation theatre.

**Questions the manual must answer.**

- What minimum design is required before an experiment may start?
- Which test types are valid for which claim type, and when is an experiment unethical, confounded, or too weak to interpret?
- How are success, failure, mixed results, stop conditions, and sample limits set before results arrive?
- Who evaluates results, and when can they change claim confidence or a decision?

**Likely rules/frameworks.**

- Every experiment needs a target claim and scope, method, target population, sample/effort, pre-committed success/stop/mixed thresholds, expected decision, duration/cost, confounders, and linked execution tasks.
- Prefer the cheapest test that can change the decision. Match test to claim: interview/workflow observation for problem; prototype/concierge use for solution; real offer, deposit, or paid pilot for price; channel test for reach; spike/benchmark for technical feasibility.
- Do not call a survey, landing page, or social post “validation” without a stated inferential limit. A result can show interest without proving purchase, retention, or scalable channel economics.
- Evaluate results against the pre-committed rule first, then record caveats, counterevidence, sample/scope limits, confidence delta, decision recommendation, and whether replication is needed. The founder confirms consequential updates.
- Do not run experiments that expose users to avoidable harm, deceptive promises, unlawful data practices, or unnecessary spending.

**Failure modes.** The AI retrofits success criteria, treats qualitative praise as proof, runs many weak tests, changes multiple variables at once, or says “invalidated” when a test only failed to produce enough evidence.

**Database implications.** Expand `experiments` with hypothesis claim/version, scope, decision affected, design JSON, pre-registered success/stop/mixed criteria, cost/time budget, confounders, data collection references, results, interpretation, confidence effect, and review/approval state. Make outcome data append-only.

**Example scenario.** A landing page with 80 sign-ups validates that an ad/message can attract curiosity. Because no paid commitment was requested, the AI leaves willingness-to-pay unvalidated and proposes a follow-up offer test.

## 13. Customer discovery and problem validation

**Purpose.** Specify how the cofounder learns from customers without leading them, overfitting anecdotes, or mistaking founder enthusiasm for market demand.

**Questions the manual must answer.**

- Which customer segment should be contacted next, and when is segmentation sufficiently specific?
- When does the AI recommend interviews, observation, sales calls, diary studies, research, or no more discovery?
- What questioning and synthesis standards protect against leading questions and confirmation bias?
- What patterns count as problem evidence, and what makes a problem urgent enough to act on?

**Likely rules/frameworks.**

- Seek evidence of an existing behavior: frequency, trigger, current workaround, cost, urgency, consequence of inaction, budget/authority, and willingness to introduce or continue a discussion. Ask about past events rather than preference for a proposed solution.
- The AI drafts a short, segment-specific interview guide; it avoids pitching early and labels all summaries as interpretations linked to raw notes.
- Stop purely exploratory interviews when the current question has enough directional evidence for a cheaper action-changing test, not after an arbitrary magic number. Continue if evidence is conflicting, sampling is narrow, or buyer/user are unresolved.
- Distinguish customer, user, buyer, champion, and blocker. Do not generalize one person’s pain or authority to the buying process.

**Failure modes.** Leading “would you use this?” questions, collecting compliments, relying on founders’ friends, analysing too long, or overlooking the buyer because users love the concept.

**Database implications.** Add a `contacts/participants` model with consent and segment metadata, `interviews` and `interview_observations`, transcript/reference links, participant role, recruitment source, structured extracted signals, and privacy retention rules. Evidence references these records rather than duplicating personal data into every claim.

**Example scenario.** Ten users say data entry is annoying, but none has budget authority. The AI identifies the operations manager as the buyer hypothesis and recommends buyer conversations before prioritizing a feature build.

## 14. Solution, pricing, sales, and distribution validation

**Purpose.** Ensure that a real problem does not get mistaken for a viable business and that each commercial uncertainty receives the right test.

**Questions the manual must answer.**

- What distinguishes solution desirability, usability, willingness to pay, buyer authority, sales motion, and channel viability?
- When can an offer precede a product, and when does a prototype or manual delivery make sense?
- How should the AI choose price tests, sales asks, and channel tests without conflating their results?
- What evidence validates a repeatable distribution hypothesis versus one lucky sale?

**Likely rules/frameworks.**

- Maintain distinct claims for: value delivered, solution fit, price/packaging, buyer authority, sales conversion, channel access, acquisition cost, and delivery economics. Evidence for one does not automatically validate another.
- Prefer a specific paid offer with a clear outcome, buyer, price, and delivery boundary over vague “would you pay?” questions. A founder can sell manually before software is built if delivery and ethics permit.
- Test the direct, controllable channel first unless the business model demonstrably requires a different one. Treat channel reach, qualification, conversion, and economics as separate measures.
- A paid pilot validates a scoped purchase. It does not prove retention, expansion, or repeatable sales; capture those as follow-on claims.

**Failure modes.** Building an attractive prototype with no offer, treating clicks as purchase intent, declaring product-market fit from a single founder network sale, or solving price and distribution with one ambiguous test.

**Database implications.** Store offers, price/packaging versions, sales opportunities, buyer roles, sales activities, commitments, revenue events, channel tests, funnel measures, delivery cost, and link them to claims and experiments. Current generic evidence records cannot cleanly model a sales pipeline or distinguish payment from a verbal promise.

**Example scenario.** A prospect asks for a demo but rejects the price. The AI records support for problem/solution interest and contradictory evidence for current pricing; it does not call the whole business invalidated.

## 15. MVP, build, launch, and first-sale policy

**Purpose.** Provide a disciplined rule for when building is justified and how to avoid premature product scope while still helping founders fulfill real customer demand.

**Questions the manual must answer.**

- What evidence threshold justifies a build task, and what exceptions apply to technical, regulated, or long-sales-cycle products?
- How is an MVP defined by customer outcome, delivery path, and learning—not a feature checklist?
- When should a founder use a manual/concierge process, no-code tool, prototype, or production build?
- What does first sale mean for various payment/contract models, and what actions follow payment?

**Likely rules/frameworks.**

- Build only when it is needed to deliver a credible offer, test a specific solution/technical hypothesis, honor a customer commitment, or materially reduce a validated delivery bottleneck. “It might be needed someday” is insufficient.
- Define MVP as the minimum reliable workflow that lets a target customer obtain the promised outcome at a stated scope. Every feature needs a linked customer outcome, commitment, risk, or legal/safety requirement.
- Prefer manual delivery and reversible tools where they can generate the same learning. Do not recommend a fake-door or concierge test if it would mislead customers or cannot be fulfilled responsibly.
- First-dollar policy: recognize money actually received and clearly distinguish it from deposits, signed intent, invoices sent, free pilots, credits, and prospective revenue. On first payment, verify delivery/retention obligations, capture learning, and avoid prematurely pivoting to scale planning.

**Failure modes.** An elaborate MVP precedes demand, a founder cannot fulfill a paid pilot, feature voting replaces outcome evidence, or the AI celebrates a signed verbal commitment as first revenue.

**Database implications.** Add an `offer/delivery` object, feature-to-outcome links, build rationale, fulfillment status, revenue ledger references, payment state, customer obligations, and post-sale feedback/renewal fields. Keep financially authoritative payment data separate from AI interpretation.

**Example scenario.** A buyer pays for a weekly report. The AI recommends producing the first reports manually and measuring use before recommending automation, instead of immediately building a dashboard.

## 16. Proactive conversation initiation and session orchestration

**Purpose.** Define proactive behavior that feels timely and helpful rather than intrusive, repetitive, or arbitrary.

**Questions the manual must answer.**

- What events permit the AI to initiate a session: startup open, task due, experiment result, blocker, meaningful state change, inactivity, or founder preference?
- How does it select an opening topic, cadence, tone, and call to action?
- When should it remain silent because no evidence-backed prompt exists?
- How does it avoid repeating an unanswered prompt, disrupting active work, or nagging a stalled founder?

**Likely rules/frameworks.**

- The opening generator uses a deterministic trigger and candidate-action selection before language generation. It may only cite current, attributable state and must link its prompt to an active objective, commitment, risk, or founder-requested cadence.
- State the observed change or pending item, why it matters, and one easy next move. Ask at most one new strategic question in an opening.
- Apply cooldowns, dismissal/snooze semantics, quiet hours, and a “no justified prompt” outcome. Never fabricate urgency or imply that the founder promised something they did not.
- Prefer a helpful check-in after a committed date, an experiment outcome, a customer event, or a high-confidence blocker. Inactivity alone is a low-strength trigger and should use permission-based language.

**Failure modes.** The AI rehashes the project snapshot every login, pesters the founder, surfaces stale tasks as urgent, or opens with an unrelated form question.

**Database implications.** Add `session_state`, `conversation_initiations`, trigger/source, prompt candidate/rationale, delivery status, cooldown/snooze/preference data, and founder response outcome. This must be separate from the content of normal chat turns.

**Example scenario.** On opening the app, the AI sees that the founder planned to send a paid-pilot offer yesterday. It asks whether it was sent and offers to review the draft; it does not start a new competitor-analysis thread.

## 17. Conversation management, questions, and personalization

**Purpose.** Make each conversation natural, stateful, and efficient while retaining the AI’s ability to drive progress.

**Questions the manual must answer.**

- What is the turn-level structure: acknowledge, orient, reason, recommend, ask, act, record, and close?
- When should the AI ask a question, make a labelled inference, provide a draft, or proceed with a recommendation?
- How many questions are acceptable, and how does the AI respond when the founder answers only part of one?
- Which preferences personalize communication versus change substantive recommendations?

**Likely rules/frameworks.**

- Before each turn, choose one conversation intent: clarify, decide, plan, execute, evaluate, reflect, or unblock. Do not mix several strategic intents unless the founder explicitly asks.
- Ask a question only when the answer can change the immediate action, assess feasibility, resolve a material contradiction, or obtain required consent. Explain the reason concisely when it is not obvious.
- Favor one high-information, low-burden question; offer a safe default and a way to correct an inference. Batch closely related details only after the founder opts into planning.
- Personalize tone, depth, task size, and timing. Never personalize away evidence standards, user control, or safety boundaries.
- End a substantive turn with a clear state: a founder question, a proposed action awaiting confirmation, a created/updated record, or an explicitly stated wait condition.

**Failure modes.** Questionnaire behavior, generic consultancy, a passive “how can I help?” loop, overly long unsolicited plans, or storing an answer to one question as consent for a different update.

**Database implications.** Store conversation turns with speaker/turn intent, referenced state, extraction candidates, clarification status, explicit confirmations, and a compact session summary. Founder communication preferences belong in a preference model, not in the evidentiary record.

**Example scenario.** The founder says, “Nobody has replied.” Rather than asking six profile questions, the AI asks to see the exact target and message because that determines whether the next action is iteration, a different channel, or more time.

## 18. Disagreement, challenge, ambiguity, pivots, and stalled founders

**Purpose.** Give the AI a humane but rigorous method for conflict, uncertainty, and loss of momentum.

**Questions the manual must answer.**

- When should the AI challenge a founder, and how strongly should it do so?
- What happens when a founder disagrees with evidence, rejects a recommendation, or intentionally chooses a riskier path?
- How is ambiguity represented without repeatedly demanding precision?
- What evidence or decision process warrants a pivot, and how is a pivot separated from routine iteration?
- How does the AI help a stalled founder without becoming either a cheerleader or a scold?

**Likely rules/frameworks.**

- Challenge a claim when it is material, weakly supported or contradicted, and affects a near-term decision. State the exact claim, evidence and limits, consequence if wrong, and a cheap resolving move. Challenge the reasoning, never the founder’s competence.
- A founder may consciously accept risk. Record it as a time-bounded decision with review trigger; do not relabel the underlying assumption as validated.
- Mark genuine ambiguity as `unknown`, `ambiguous`, or `multiple plausible interpretations`; use reversible defaults when the ambiguity is not decision-critical.
- A pivot changes a foundational claim (customer, problem, value proposition, buyer, delivery, business model, or primary channel). Require a written pivot thesis, evidence/rationale, commitments to unwind, preserved learning, and a new short validation objective. Small offer or message changes are iterations.
- For stalled founders, diagnose the constraint—unclear next action, fear, capacity, missing access, competing priority, low conviction, or external dependency—then propose one smaller, permission-based step or a deliberate pause. Do not simulate urgency.

**Failure modes.** Excessive agreeableness preserves a doomed path; excessive skepticism causes paralysis; a pivot is recommended from one bad interview; ambiguity becomes fake certainty; or the app nags a founder who lacks time.

**Database implications.** Add `challenge_records`, founder response/override, ambiguity state, risk-acceptance decisions, pivot events, archived-but-retrievable prior strategy, stall reason, follow-up preference, and review triggers.

**Example scenario.** The founder wants to build despite no buyer interviews. The AI explains that buyer authority is untested and proposes two calls before a large build. If the founder still builds, it records the decision and keeps the buyer claim unvalidated.

## 19. Context retrieval, context assembly, and memory boundaries

**Purpose.** Give the model enough relevant context to be consistent without flooding it with stale, private, or conflicting information.

**Questions the manual must answer.**

- What data must be retrieved for every turn, and what is retrieved only by topic, entity, recency, or conflict?
- How should current snapshot fields, source records, historical versions, task state, and conversation history be reconciled?
- Which sources win when state conflicts, and when should the AI surface the conflict instead of selecting one?
- How are sensitive fields filtered and data minimized?

**Likely rules/frameworks.**

- Build a structured context packet, not a database dump: active objective/milestone; active recommendation; current stage and rationale; high-ranked relevant claims with evidence/counterevidence; relevant decisions; active/blocked tasks and experiments; recent changes; founder preferences/constraints; and a bounded recent conversation summary.
- Retrieval should be entity- and claim-centric, include both supporting and contradicting evidence, and attach source IDs/dates to every supplied assertion. Use older history only when it explains a current claim, decision, or contradiction.
- The read model determines canonical current state. When source authority or scope conflicts, the model receives the conflict marker and must not silently choose a winner.
- Apply least-privilege filtering: only retrieve personal/customer data necessary for the response; avoid raw sensitive transcripts if a privacy-safe summary suffices.

**Failure modes.** Token bloat, stale context dominates new evidence, the AI makes unsupported references to remembered details, or sensitive customer information leaks into unrelated responses.

**Database implications.** Define a versioned `context_packet` contract and retrieval audit: source IDs/versions, retrieval reason, generated summary provenance, privacy class, and TTL. Add indexes and relations around active claims, events, task state, and dates; do not rely on an unbounded `project_memory_summary` as truth.

**Example scenario.** When discussing pricing, the context includes the active pricing claim, two sales calls, the current offer, and the last price decision—not every interview transcript or a stale competitor note from six months ago.

## 20. Database read/write protocol and structured-state updates

**Purpose.** Turn LLM extraction into auditable, safe state changes rather than letting chat text mutate company memory invisibly.

**Questions the manual must answer.**

- Which model outputs are observations, update proposals, drafts, or confirmed writes?
- Which writes are automatic, which require founder confirmation, and which require server-side validation or domain review?
- How are duplicate claims, idempotency, race conditions, deletion, and correction handled?
- How are updates shown back to the founder and revised later?

**Likely rules/frameworks.**

- Use a command protocol: `read context → produce typed proposed changes with citations/confidence → validate schema and policy → deduplicate/compute effects → request confirmation if material → transact write → emit event → refresh projections`.
- Models never directly execute SQL or provide free-form state mutations. Use narrow, schema-validated tools with enumerated field changes and relationship IDs.
- Automatically record low-risk conversation metadata and *draft* extraction candidates. Require confirmation for durable customer/buyer/problem/price/strategy fields, new critical claims, evidence interpretations, stage changes, experiment starts/results, material decisions, deletions, and pivots.
- Preserve corrections as append-only versions. Use soft delete/retire plus an audit reason for material data; a founder may correct an AI extraction without treating the original mistaken extraction as a company claim.
- Calculate derived values such as risk ranks and stale flags deterministically and recompute after writes; do not trust an LLM to update related scores consistently.

**Failure modes.** Hallucinated project data, lost audit trails, partial updates that leave inconsistent state, confirmation fatigue, duplicate assumptions, or an AI summary overwriting a founder’s words.

**Database implications.** Add typed `change_proposals`, confirmation batches, schema/policy validation results, idempotency keys, `entity_versions`, write events with before/after references, source-turn IDs, computed-field ownership, and projection rebuild support. The current `event_log` needs a consistent payload schema and write-path enforcement to serve this role.

**Example scenario.** The founder says, “Maybe agencies could be better buyers.” The AI creates a displayed draft inference/alternative segment, not a current target-customer update, and asks whether to treat it as a hypothesis worth testing.

## 21. Reliability guardrails, calibrated skepticism, and quality review

**Purpose.** Prevent the most damaging AI behaviors: fabricated knowledge, excessive agreeableness, blanket skepticism, misleading business claims, and inconsistent decisions.

**Questions the manual must answer.**

- What must the AI never assert without an attributable source?
- Which situations require an explicit uncertainty statement, a refusal, or referral to a qualified professional?
- How should it balance evidence-based challenge with founder goals and strategic creativity?
- What automated and human review checks apply to recommendations and memory writes?

**Likely rules/frameworks.**

- Prohibit claims of customer contact, payment, experiment outcome, market fact, legal/compliance status, competitor detail, or task completion unless a cited source exists in the project context or an approved external source. Use “I infer,” “you said,” and “the evidence suggests” precisely.
- Separate factual accuracy, evidentiary calibration, strategic usefulness, tone, and founder autonomy in evaluation. A friendly response that causes a bad action is a failure.
- Require source-grounding checks before response and write; ensure confidence language matches evidence; run contradiction and stale-evidence checks for material recommendations; redact/limit sensitive data.
- Calibrated skepticism policy: challenge only where materiality plus evidence weakness/contradiction merits it; otherwise accept the founder’s stated preference and help execute it.
- Create incident categories for memory corruption, fabricated evidence, unsafe advice, privacy leakage, and repeated nagging, with rollback and review paths.

**Failure modes.** The AI invents an interview insight, constantly says “great idea,” derails every choice with objections, offers legal certainty, or handles personal data carelessly.

**Database implications.** Log source-grounding results, validation warnings, safety flags, response/recommendation quality signals, incident reports, rollback linkage, evaluation fixtures, and access/audit records. Do not use hidden model reasoning as an audit substitute; store concise, user-safe rationale and source links.

**Example scenario.** The founder asks whether student data handling is compliant. The AI identifies the missing jurisdiction and data flow, recommends qualified review, and does not mark regulatory risk low based on generic advice.

## 22. Deterministic services, LLM responsibilities, and system evaluation

**Purpose.** Make the system reproducible enough that two instances receive similar inputs and arrive at comparable priorities, while retaining language and situational reasoning strengths.

**Questions the manual must answer.**

- Which decisions belong in application logic, which use scoring, and which require LLM judgment?
- What input/output contracts, models, prompts, and tests make behavior stable?
- How is recommendation quality measured against actual founder outcomes without optimizing for superficial metrics?
- How are policies changed without silently changing historical interpretation?

**Likely rules/frameworks.**

- Application logic owns permissions, schema validation, event/version writes, stage prerequisites, task/experiment lifecycle validation, evidence link integrity, risk-score calculation, candidate generation, cooldowns, and deterministic eligibility filters.
- The LLM owns extraction proposals, semantic deduplication suggestions, qualitative evidence interpretation with citations, conflict explanations, hypothesis/experiment drafts, trade-off explanations, and natural conversation.
- Use a policy engine to combine hard eligibility rules with versioned ranking weights and prompt-level judgment. Record the policy version and input snapshot behind each recommendation.
- Evaluate with scenario fixtures and counterfactuals: same context should produce the same eligible action class; seeded contradictory evidence should change advice; null fields alone should not trigger questioning; payment should outrank praise for price claims.
- Measure outcome quality with decision clarity, valid evidence captured, meaningful task completion, time to customer interaction/offer/payment, founder override reasons, stale recommendation rate, and harm/error rates. Avoid treating chat time, number of fields, or raw tasks completed as success.

**Failure modes.** Prompt-only business logic changes unpredictably, scoring hides normative choices, model updates rewrite behavior, evaluations reward fluent text, or business outcomes are attributed to AI without a comparison/control.

**Database implications.** Add `policy_versions`, recommendation input/output snapshots, score components, model/prompt/tool versions, simulator fixtures, evaluation results, and outcome telemetry. The app needs an event schema appropriate for replay, not just free-form summaries.

**Example scenario.** Two projects have the same evidence but different communication preferences. The deterministic policy selects the same paid-offer experiment; the LLM changes only how concisely it presents the action.

## 23. Governance of the manual and change control

**Purpose.** Keep the operating manual coherent as the product expands, instead of accumulating contradictory exceptions and prompt patches.

**Questions the manual must answer.**

- Who can change a hard rule, a score weight, a taxonomy, or a prompt behavior, and what evidence is required?
- How are migrations to new claim semantics or policies handled for existing projects?
- Which exceptions are business-model-specific rather than general rules?
- What review cadence detects that a policy is causing harm or non-progress?

**Likely rules/frameworks.**

- Version the manual, data semantics, policy configuration, and evaluation suite together. Each change should state hypothesis, affected behavior, backward compatibility, migration, rollout, and rollback plan.
- Add exceptions as explicit policy modules by business model/risk domain only when repeatable evidence warrants them. Do not hide exceptions in a general prompt.
- Require regression tests for all hard-rule changes and scenario evaluation for heuristics/judgment changes. Audit founder overrides and recommendation dismissals for systematic failure modes.
- Preserve historical recommendations with the policy under which they were made; do not reinterpret the past as though new policy had always applied.

**Failure modes.** Prompt drift, irreproducible founder experiences, migrations silently changing beliefs, a growing list of untested special cases, and inability to investigate why a recommendation was made.

**Database implications.** Store `manual_version`, policy module/version, migration history, feature flags/rollout cohort, evaluation run, and rollback events on relevant records.

**Example scenario.** A new rule reduces the weight of waitlists as purchase evidence. Existing projects retain their historical assessment but are flagged for review, rather than silently changing confidence overnight.

---

## Hard rules vs. heuristics vs. scored decisions vs. LLM judgment

The manual should make the following boundary explicit. A rule should not be left to prose prompt interpretation merely because it is easier to write.

| Behavior | Hard rule / deterministic application logic | Heuristic or scored decision | LLM judgment call |
| --- | --- | --- | --- |
| Authority and consent | Material changes and external actions require the defined approval state; no direct external action without authorization | None | Explain permission and draft alternatives |
| Memory and provenance | No material current state without actor, source, time, scope, and version; never overwrite history | Flag source quality or staleness | Extract candidate claim/value and summarize why it matters |
| Taxonomy | Valid enum/state transitions; a hypothesis requires required fields | Suggest classification confidence | Resolve ambiguous wording and propose a class |
| Evidence | Evidence cannot be authored as an observed fact without a source; retain counterevidence | Evidence-quality components and confidence bands | Interpret relevance and caveats of a source |
| Contradictions | Never silently delete or auto-resolve a material conflict | Prioritize conflicts by decision impact | Determine whether scope/context reconciles apparent conflict |
| Stage lifecycle | Allowed stage states and required transition records | Stage confidence; candidate readiness | Explain exceptions and propose stage rationale |
| Gap selection | Null field alone cannot create a required question | Materiality/testability/priority ranking | Identify non-obvious candidate gaps from context |
| Next action | Action must be eligible, feasible, non-duplicative, and linked to an objective; focus limits apply | Expected decision value per founder hour, momentum, risk, deadline | Select/word an action among close, contextual candidates |
| Task/experiment | Required schemas; completed result cannot be invented; experiment criteria are locked before evaluation | Effort, cost, sample sufficiency, test rank | Draft design, assess qualitative result limits |
| Conversation | One active strategic objective by default; no fabricated references; respect snooze/cooldown | Question information value and desired response length | Tone, wording, ordering, and natural follow-up |
| Challenge and pivots | Do not mark a risk accepted as validated; pivotal changes require explicit record | Materiality threshold and pivot-likelihood score | Deliver challenge empathetically; synthesize a pivot thesis |
| Safety and privacy | Restricted data access, redaction, escalation, and forbidden claims | Risk triage/candidate escalation | Explain limits and ask only needed facts |
| Evaluation | Every recommendation and update is replayable with policy/model versions | Quality trend thresholds | Qualitative review of usefulness and clarity |

### Precedence hierarchy

1. Legal, safety, privacy, truthfulness, and explicit founder-consent hard rules.
2. Data integrity and lifecycle hard rules.
3. Stage and objective eligibility rules.
4. Deterministic scoring/ranking with visible inputs and policy version.
5. LLM judgment among eligible, similarly-ranked paths.
6. Style/personalization preferences.

When a higher layer blocks a lower-layer choice, the AI must explain the practical constraint rather than pretending the blocked option was not considered.

---

## Core decision frameworks the system needs

1. **Objective hierarchy and safety gate.** Is the action aligned with the current goal and permissible given safety, legal, privacy, and founder authority constraints?
2. **Claim-state classifier.** Is this a fact, founder statement, inference, assumption, hypothesis, decision, or finding? What is its scope and operating status?
3. **Evidence-quality assessment.** Assess directness, behavior versus opinion, independence, sample/repetition, specificity, recency, bias, and claim fit.
4. **Contradiction and scope reconciliation.** Is evidence actually contradictory, or is it about a different segment, condition, time, or wording?
5. **Materiality / important-unknown test.** Would resolving this uncertainty change a near-term decision, first-revenue path, costly commitment, or safety position?
6. **Risk-to-test priority model.** Rank by impact if wrong, uncertainty, evidence weakness, dependency leverage, revenue proximity, testability, cost, time, and founder capacity.
7. **Action-mode classifier.** Choose conversation, task, experiment, research, build, sell, wait, or intentional deferral based on the type of missing progress.
8. **Expected decision value per founder hour.** Prefer actions likely to change an important decision or unlock a milestone relative to effort, delay, and feasibility.
9. **Evidence-to-action threshold.** Specify what evidence is enough to proceed with reversible execution, a paid offer, a build, a larger commitment, or a pivot.
10. **Experiment adequacy model.** Check claim/test fit, target population, success rules, sample/effort, confounders, ethics, and whether the result can change the decision.
11. **Reversible-versus-irreversible decision test.** Bias toward small reversible bets; require stronger evidence, review, and founder approval for one-way or high-cost choices.
12. **Build-versus-sell / manual-versus-automate test.** Build only for deliverability, a technical test, a customer obligation, or an evidenced delivery bottleneck.
13. **Stage transition gate.** Use business-model-appropriate evidence criteria with track-level confidence rather than one universal funnel.
14. **Recommendation explanation contract.** Recommendation, objective, evidence/assumptions, trade-offs, confidence, smallest step, definition of done, and review trigger.
15. **Proactive prompt eligibility and fatigue model.** Trigger only from justified state; respect cooldowns, quiet hours, dismissals, and founder preferences.
16. **Founder-overrides-and-risk-acceptance protocol.** Preserve agency while recording accepted risk and future review conditions.
17. **Pivot test.** Identify whether the proposed change alters a foundational claim, captures evidence/reason, preserves learning, resolves commitments, and establishes a new validation objective.
18. **Stall diagnosis.** Classify unclear work, lack of access, capacity, fear, low conviction, external dependency, or competing priority; prescribe a different response for each.

---

## Architectural and product questions to resolve before writing the final manual

These choices are not prompt details; they determine whether the manual can be implemented reliably.

1. **Canonical memory model.** Will the product adopt a versioned claim graph as the source of truth, or will it continue using separate `projects`, `assumptions`, and `decisions` records as overlapping truth? The latter will make provenance and contradiction management fragile.
2. **Fact definition.** What source types are allowed to establish a fact, and is “fact” a necessary product-facing label? Consider using “observed/verified claim” to avoid implying universal certainty.
3. **Founder confirmation UX.** Which material fields should require explicit confirmation, and how can confirmation be batched without creating a form experience? The answer affects trust and memory quality.
4. **Confidence semantics.** Are confidence bands calculated from explicit component scores, entered by the founder, assessed by the AI, or a hybrid? Define which can change automatically and how counterevidence behaves.
5. **Evidence storage and privacy.** Will raw transcripts/audio be retained? What consent, redaction, retention, access control, and customer-data policies apply? A project-memory system cannot defer this indefinitely.
6. **External research policy.** May the AI browse or import public data? If so, how will sources be cited, dated, licensed, and separated from founder/market evidence? What claims require source refresh?
7. **Business-model coverage.** Is v1 for self-serve software, founder-led B2B, services, marketplaces, or all? “First dollar” has materially different evidence paths. Start with a narrow segment or make explicit policy modules.
8. **Definition of first revenue.** Does it mean settled cash, a deposit, a signed paid contract, an invoice, a marketplace payout, or something else? How are refunds, taxes, credits, and revenue recognition handled?
9. **Sales execution boundary.** Can the AI send emails, schedule meetings, create CRM records, or charge customers? If integrations are added, a granular authorization and draft/approval model is mandatory.
10. **Stage and score ownership.** Which aspects are founder-visible/editable? Which are derived application logic? Avoid letting an LLM silently advance stages or set risk scores without a transparent basis.
11. **Experiment governance.** Who can declare a result, change a success threshold, or close a test? How are qualitative and quantitative tests handled without false statistical claims?
12. **Personalization versus consistency.** Which preferences may alter timing, wording, or task granularity, and which recommendations must remain invariant for equivalent state?
13. **Proactivity and notifications.** What channels, cadence, consent, quiet hours, and stop/snooze controls are required? Is an in-app opening sufficient for v1?
14. **Collaborative projects.** Are there cofounders, advisors, employees, or multiple buyers/contacts? If so, define entity authority, conflicting inputs, and attribution before the data model hardens.
15. **Safe-domain policy.** Which regulated or high-risk industries are supported, restricted, or require a specialized review flow? Generic startup coaching is not enough for health, finance, employment, children, or regulated hardware.
16. **Success measurement and attribution.** How will the team know the AI helped rather than merely correlated with founder momentum? Define cohorts, leading indicators, outcome instrumentation, and qualitative review.
17. **Retention and deletion.** Can a founder export, correct, or delete project history? How will deletion requests interact with immutable audit history and analytics?
18. **Model/tool failures.** What is the fallback behavior when retrieval is incomplete, a tool fails, or a model produces malformed structured output? The safe answer is often “I do not have enough reliable project state,” not a plausible guess.

---

## Critical assessment of the proposed architecture

### What is sound

- The existing principle—database remembers, LLM reasons, founder decides—is the correct foundation.
- Assumptions, evidence, experiments, tasks, and decisions are the right first-class concepts for an evidence-driven product.
- The current risk model correctly emphasizes first-revenue blockers and recognizes that not every unknown matters.
- The onboarding draft/confirmation pattern is a good start for protecting project memory.

### What is overengineered or fragile if implemented too early

- **A fully populated startup ontology is not the MVP.** Do not make every market, competitor, segment, feature, and metric field mandatory. Begin with one complete loop: named customer/problem → evidence → risky claim → offer/test → outcome → next action.
- **A universal stage machine will be misleading.** Build, launch, and first revenue are not sequential for every company. Use a small core plus track-specific evidence, especially if v1 includes services or enterprise sales.
- **Numeric risk scores create false precision.** The proposed `1–5` or `0–100` score is helpful only as a transparent, changeable ranking aid. The application should display factors and rationale, not “4.6 means objectively correct.”
- **Automatic confidence updates are unsafe without claim-specific evidence semantics.** A payment can strongly support a paid offer in one scope but says little about channel scalability, retention, or another segment.
- **The LLM should not be the state machine.** Prompt instructions alone cannot safely enforce lifecycle transitions, historical versioning, confirmation, access control, deduplication, or score recalculation. These belong in typed server-side commands and deterministic services.
- **An event log alone is not historical belief management.** It records that something happened but does not identify a canonical claim version, scope, supersession relation, or reconciled current projection.
- **Treating all AI-generated assumptions as persistent memory will create noise.** Generate candidate risks ephemerally; persist only those selected, confirmed, or materially used in an active recommendation, with `ai_inferred` provenance.
- **Proactivity can damage trust.** Do not build complex notification logic before there is reliable state, a useful next-action policy, and founder controls. In-app state-aware openings are a safer first release.
- **Do not claim “validated” too readily.** Use scope-qualified support bands and prevent labels such as “product-market fit” in the pre-revenue operating manual unless the product explicitly defines high evidence thresholds.

### Data-model gaps relative to the operating manual

The current tables provide a credible foundation but need deliberate additions before the final manual promises the above behaviors:

- immutable, scoped `claims` and `claim_versions` as canonical belief memory;
- field-level provenance and a formal projection from claims to project snapshot fields;
- richer source/evidence records and versioned evidence-to-claim links, including mixed/does-not-address relations;
- `change_proposals` and explicit confirmation/approval records;
- recommendation/action records with input state, policy version, candidates, rationale, dismissal, and outcome;
- structured experiment design/results/interpretation records;
- sales offers, customer commitments, and payment-state references;
- milestone/task dependencies and objective links;
- session/proactivity state and founder notification preferences;
- policy/model/prompt versioning and replayable evaluation fixtures.

---

## Recommended design and implementation order

Do this in vertical slices. A rich data model without a reliable next-action loop will not help founders; a fluent chat without trustworthy memory will lose their confidence.

1. **Set product scope and authority boundaries.** Choose the initial business-model segment; define first-dollar, external-action, safety/privacy, and founder-confirmation policies.
2. **Define the canonical claim and evidence semantics.** Finalize taxonomy, scope, provenance, source/evidence link, confidence band, versioning, and corrections. These decisions drive every other subsystem.
3. **Build typed, auditable memory writes.** Implement proposal → validation → confirmation → transactional write → event/version → projection. Add read-only replay fixtures before adding proactive behavior.
4. **Implement the minimal first-revenue state and context packet.** Model active objective, milestone, claims, evidence, decisions, tasks, and experiments. Do not attempt complete company intelligence.
5. **Implement deterministic gap candidate generation and priority ranking.** Show factors and allow founder correction; use LLM reasoning only to propose/explain candidates.
6. **Build the single-next-action engine.** Deliver one recommended action with rationale, definition of done, and follow-up state. First support conversation, task, experiment, and wait classifications.
7. **Implement customer evidence intake and claim-linked synthesis.** Start with interview/sales-note evidence and manual source entry; preserve raw references and opposing signals.
8. **Implement experiment and offer loops.** Support pre-committed test designs, results, evaluation, paid-pilot/offer records, and decision updates.
9. **Add task, milestone, and constraint-aware execution management.** Keep the queue deliberately small and verify that recommendations survive new evidence and founder capacity changes.
10. **Add build/MVP and first-sale policies.** Require delivery/obligation modeling before encouraging payment or automating product scope decisions.
11. **Introduce controlled in-app proactivity.** Begin with active-objective openings and founder-controlled cooldowns; add notifications only after usefulness is proven.
12. **Add contradiction, pivot, stall, and advanced personalization flows.** These rely on historical data and should be evaluated with real project traces, not only synthetic prompts.
13. **Add policy modules and advanced integrations deliberately.** Expand to other business models, external research, CRM/email/payment tools, and multi-user collaboration only once authority and data governance are mature.
14. **Continuously evaluate and govern.** Maintain replay tests, red-team for fabricated memory and over-agreeableness, review overrides, and version all policy changes.

### First end-to-end release criterion

Before expanding the ontology, the product should be able to take a founder from an idea to this repeatable loop without inventing state:

```text
Founder describes an idea
  → founder confirms a small current snapshot
  → AI proposes and explains the most material uncertain claim
  → founder accepts/edits a test or paid-offer task
  → founder records attributable evidence/result
  → AI links it, updates only the justified claims with approval,
     and recommends the next smallest high-leverage move.
```

If that loop reliably produces customer conversations, credible offers, and paid commitments while keeping the reasoning inspectable, the product has earned the complexity of broader roadmap, automation, and growth systems.
