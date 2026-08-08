# Task: Design the Outline for an AI Cofounder Operating Manual

You are a senior AI product architect, startup advisor, and prompt/system-design expert.

Your task is to create a comprehensive outline for an **AI Cofounder Operating Manual**.

Do NOT write the final operating manual yet. Instead, design the structure, rules, decision frameworks, and behavioral categories that the eventual operating manual must define.

## Product Context

We are building an evergreen AI startup cofounder whose primary objective is to guide a founder from an early-stage idea toward earning their **first dollar**, and eventually toward a repeatable business.

The primary user experience is an ongoing conversation.

Unlike a traditional chatbot, the AI should proactively drive the conversation. When the founder opens the application, the AI can initiate the conversation based on the current state of the startup.

The AI has access to a persistent structured database representing its current knowledge of the startup.

The database may contain:

- Founder-provided facts
- AI-inferred information
- Assumptions
- Hypotheses
- Customer segments
- Problems
- Users vs. buyers
- Value propositions
- Pricing hypotheses
- Business model
- Industry
- Competitors
- Distribution channels
- Product/MVP definitions
- Features
- Risks
- Constraints
- Decisions
- Experiments
- Experiment results
- Customer interviews
- Evidence
- Tasks
- Milestones
- Metrics
- Current blockers
- Current startup stage
- Historical versions of previously held beliefs

Fields may initially be unknown/null and become populated naturally through conversation.

The system maintains historical records whenever important project information changes. The AI therefore needs to understand not only **what the startup currently believes**, but also **how those beliefs changed and what evidence caused the change**.

## Core Product Philosophy

The AI's job is NOT simply to fill every empty database field.

Its job is to help the founder make progress.

Missing information matters only when resolving it would materially improve the founder's ability to make the next decision or reach the next milestone.

The AI should continuously ask:

**"Given everything currently known about this startup, what is the highest-leverage thing the founder should do or learn next?"**

The product should optimize for progress toward first revenue rather than completeness of documentation.

## Belief and Evidence Model

The AI should distinguish between:

- Unknowns
- Founder opinions
- AI inferences
- Assumptions
- Hypotheses
- Decisions
- Observations
- Evidence
- Validated findings
- Invalidated findings
- Facts

The AI must never silently transform an assumption into a fact.

Important beliefs should have some representation of:

- Confidence
- Importance
- Supporting evidence
- Contradicting evidence
- Source/provenance
- Validation status
- Last updated date

The system should preserve historical versions rather than simply overwriting previous beliefs.

## Hypothesis Testing Philosophy

The AI should identify assumptions that could materially affect the success of the startup.

Examples include:

- Does this problem actually exist?
- Does the proposed customer experience it?
- Is the problem painful enough?
- Who is the user?
- Who is the buyer?
- Will someone pay?
- How much?
- Can we reach them?
- Will they use the proposed solution?
- Can we deliver the solution economically?
- Will customers return or continue paying?

Not every unknown deserves immediate investigation.

The AI should prioritize uncertainty using concepts such as:

- Importance
- Risk if wrong
- Current confidence
- Quality of existing evidence
- Cost of testing
- Time required to test
- Dependency on other decisions
- Proximity to first revenue

The operating manual should define when the AI should:

- Ask the founder a question
- Make a clearly labeled inference
- Challenge an assumption
- Recommend research
- Recommend customer interviews
- Create an experiment
- Create a task
- Recommend building something
- Recommend selling something
- Recommend waiting for existing evidence
- Update an existing belief
- Leave an unknown unresolved

## Conversation Philosophy

The AI should behave like a thoughtful, proactive cofounder rather than:

- A questionnaire
- A database form
- A generic startup consultant
- A cheerleader
- A passive chatbot
- An idea generator that constantly changes direction

The conversation should feel natural and specific to the founder's actual situation.

The AI should avoid asking ten questions simply because ten database fields are empty.

Instead, it should identify the most important immediate issue and drive the conversation around that issue.

Questions should have a reason.

Tasks should have a reason.

Experiments should test a meaningful hypothesis.

Recommendations should connect to the current state of the startup.

## Context Available to the AI

Before generating a response, assume the AI can receive structured context including:

- Current project state
- Current startup phase
- Active hypotheses
- Confidence/status of those hypotheses
- Historical belief changes
- Recent conversation
- Important older conversations retrieved when relevant
- Current tasks
- Completed tasks
- Active experiments
- Experiment results
- Decisions
- Evidence
- Known contradictions
- Important unknowns
- Current roadmap milestone
- Current blocker

The operating manual must define how the AI should use this context rather than merely dumping all of it into the conversation.

## Desired Behavioral Loop

Conceptually, the AI should operate through a loop similar to:

1. Understand current project state.
2. Determine what changed recently.
3. Identify contradictions, gaps, risks, and uncertainties.
4. Determine which of those actually matter right now.
5. Identify the highest-leverage next objective.
6. Decide whether progress requires discussion, a decision, a task, research, or an experiment.
7. Conduct a natural conversation with the founder.
8. Extract new structured information.
9. Update beliefs and confidence appropriately.
10. Record important changes and their provenance.
11. Update roadmap/tasks/experiments where appropriate.
12. Determine what should happen next.

Do not assume this exact loop is optimal. Improve it if necessary.

# Your Assignment

Develop a detailed outline for the AI Cofounder Operating Manual.

The outline should identify every major behavioral system that needs to be specified before this AI can reliably operate.

At minimum, consider sections covering:

- Mission and objective hierarchy
- Definition of success
- AI role and boundaries
- Startup state model
- Knowledge classification
- Assumption management
- Confidence management
- Evidence standards
- Contradiction detection
- Historical state management
- Gap identification
- Prioritization of uncertainty
- Startup stage awareness
- Roadmap management
- Task creation
- Experiment creation
- Experiment evaluation
- Customer discovery
- Problem validation
- Solution validation
- Pricing validation
- Distribution validation
- MVP/build decisions
- First-sale behavior
- Conversation initiation
- Conversation management
- Question-asking rules
- Challenging the founder
- Handling founder disagreement
- AI-generated assumptions
- Recommendation standards
- Decision-making frameworks
- Avoiding premature optimization
- Avoiding unnecessary work
- Context selection
- Database read/write behavior
- Provenance requirements
- Updating structured project state
- Handling ambiguity
- Handling insufficient evidence
- Handling pivots
- Handling stalled founders
- Preventing hallucinated project knowledge
- Preventing excessive agreeableness
- Preventing excessive skepticism
- Response personalization
- Immediate-next-action selection
- Long-term project continuity

For every major section of the outline, provide:

1. **Purpose** — Why this section needs to exist.
2. **Questions the manual must answer** — The behavioral decisions that need explicit rules.
3. **Likely rules/frameworks** — Candidate principles that could govern the AI.
4. **Failure modes** — What goes wrong if this behavior is poorly specified.
5. **Database implications** — What structured information this behavior requires or produces.
6. **Example scenario** — One short example showing why the rule matters.

## Special Attention

Spend substantial effort distinguishing between:

### Missing information vs. important missing information

The AI should not interrogate the founder simply to complete its database.

### Assumption vs. hypothesis vs. fact vs. decision

These should produce different AI behavior.

### Conversation vs. task vs. experiment

Define when each is appropriate.

For example:

- A conversation may clarify what the founder believes.
- A task accomplishes known work.
- An experiment generates evidence about an uncertain belief.

### Founder evidence vs. AI reasoning

The AI may infer possibilities, but those inferences should not silently become company knowledge.

### Strategic uncertainty vs. execution

At some point the founder needs to stop discussing and actually do something.

Define how the AI recognizes that point.

### Immediate progress vs. complete startup knowledge

The system should favor the information necessary for the next important decision rather than attempting to understand the entire company before allowing progress.

## Design Requirement

The eventual operating manual should be sufficiently explicit that two instances of the AI given the same:

- Project database
- Conversation history
- Current tasks
- Evidence
- Experiments

would make broadly similar decisions about what the founder should focus on next.

At the same time, it must leave enough flexibility for natural conversation and situation-specific reasoning.

Therefore, identify which behaviors should be:

- Hard rules
- Heuristics
- Scored/ranked decisions
- LLM judgment calls

This distinction is particularly important.

## Final Output

Produce:

1. A proposed table of contents for the operating manual.
2. A detailed outline of every section.
3. A proposed hierarchy of hard rules vs. heuristics vs. AI judgment.
4. A list of the most important decision frameworks the system needs.
5. A list of unresolved architectural/product questions we must answer before writing the final manual.
6. A recommended order in which we should design and implement these systems.

Be critical of the proposed architecture.

If parts of this concept are overengineered, fragile, unnecessarily complex, or better handled through deterministic application logic rather than LLM instructions, explicitly identify them.

The goal is not to validate the concept.

The goal is to design an operating system that makes an AI cofounder **consistent, evidence-driven, context-aware, proactive, and relentlessly focused on moving a startup toward real customers and first revenue.**