# AI Cofounder Product Vision

## Local development

Milestone 3 uses Postgres for company memory and a server-only OpenAI key for onboarding drafts. Export the values from `.env.example` into your shell environment, then run:

```sh
npm install
npm run db:migrate
npm start
```

The app reads and writes through `/api/projects/:projectId/...`; `DATABASE_URL` and `OPENAI_API_KEY` are required to start the server. The browser does not load `mock-data.js`, does not call OpenAI, and never receives the API key. Onboarding drafts are editable and no profile field, assumption, or task is persisted until confirmed.

## Mission

**Help founders get from an idea to their first dollar.**

Rather than generating another business plan, the product acts as a persistent AI collaborator that remembers every important decision, tracks evidence, and continually recommends the highest-impact next step.

**Tagline ideas**

* The Pathway to Your First Dollar
* From Idea to First Dollar

---

# Core Philosophy

Current AI startup tools are largely document generators.

They create:

* Business plans
* Lean Canvases
* Pitch decks
* Marketing plans

Once those are generated, the user's relationship with the product largely ends.

Instead, this product should function as an operating system for building a company.

The AI should remember:

* decisions
* assumptions
* experiments
* customer interviews
* product roadmap
* pricing
* competitors
* validation progress

The founder shouldn't need to repeatedly explain their startup.

---

# Product Vision

Imagine opening the app.

Instead of:

> "How can I help you?"

It says:

* You interviewed three teachers yesterday.
* Two mentioned grading time as their biggest pain point.
* Your pricing assumption ($15/month) is still unvalidated.
* Your highest leverage task today is to schedule five paid pilot conversations.

The AI proactively understands where the company is and what should happen next.

---

# The Founder Journey

## Stage 1 - Idea

* Define problem
* Identify customer
* Clarify value proposition
* Analyze competitors

---

## Stage 2 - Validation

* Customer interviews
* Landing page
* Waitlist
* Pricing tests
* Problem validation

---

## Stage 3 - Build

* MVP definition
* Feature prioritization
* Technical architecture
* Development roadmap

---

## Stage 4 - Launch

* Landing page
* Stripe
* Outreach
* Social launch
* Product Hunt
* Early adopters

---

## Stage 5 - First Dollar

Celebrate the first paying customer.

---

## Stage 6+

Scale toward:

* First $1,000
* First $10k MRR
* Hiring
* Automation
* Growth

---

# Persistent Company Memory

The database, not the LLM, owns company memory.

Store structured information such as:

## Decisions

Example:

Pricing

Decision:
Teachers pay $15/month

Reason:
Initial pricing hypothesis

Status:
Active

---

## Assumptions

Example:

Teachers will pay $15/month.

Status:
Untested

Priority:
Critical

---

## Evidence

Customer Interview #12

Teacher:
"I don't care about leaderboards."

Supports:
Homework engagement matters more than competition.

---

## Experiments

Hypothesis

Teachers will pay $15/month.

Experiment

Offer paid pilot.

Success Metric

3 paid classrooms.

Status

Running.

---

## Tasks

Interview five teachers.

Priority:
High

Expected impact:
High

Estimated time:
45 minutes

---

# AI Responsibilities

The AI should:

* Remember project history
* Explain tradeoffs
* Detect contradictions
* Recommend next actions
* Generate artifacts
* Track experiments
* Summarize interviews
* Update assumptions
* Prioritize work

The AI should NOT be the source of truth.

It reasons over structured company data.

---

# Architecture

Frontend

* Web/mobile app

Backend

* Authentication
* Billing
* Project API
* AI orchestration
* Notifications
* Integrations

Database (Postgres)

Stores:

* Projects
* Decisions
* Assumptions
* Evidence
* Tasks
* Experiments
* Artifacts
* Event history

Vector Search

Stores:

* Interview transcripts
* Research
* Uploaded documents
* Brainstorming sessions

LLM

Responsible for:

* reasoning
* writing
* summarization
* prioritization
* recommendations

---

# Memory Types

## Structured Memory

Database

Examples

* Pricing
* Customer
* Revenue model
* Tasks
* Decisions

---

## Semantic Memory

Vector search

Examples

* Interviews
* PDFs
* Research
* Meeting notes

---

## Working Memory

Current conversation.

---

# Context Engineering

Every LLM request should receive only relevant project context.

Examples

"What should I build next?"

Context:

* customer interviews
* roadmap
* assumptions
* feature requests
* active experiments

"Write a cold email"

Context:

* target customer
* pricing
* value proposition
* evidence

Different prompts receive different context.

---

# Function Calling

Instead of free-form AI, expose application tools.

Examples

* Create decision
* Update assumption
* Create experiment
* Generate roadmap
* Create task
* Search evidence
* Generate artifact

The LLM proposes actions.

The backend validates and executes them.

---

# Industry Support

Use one universal company model with optional modules.

Core Profile

* Customer
* Problem
* Solution
* Revenue
* Pricing
* Validation
* Product
* Marketing

Modules

* SaaS
* Marketplace
* Education
* Local service
* Ecommerce
* Healthcare

Projects activate only the modules they need.

---

# Why This Is Different

Most AI startup tools generate documents.

This product generates progress.

Instead of asking:

"What business plan should I write?"

It asks:

"What is preventing your first customer?"

The focus becomes execution rather than planning.

---

# Business Thesis

People don't ultimately buy an AI cofounder.

They buy a higher probability of reaching their first dollar.

The AI is simply the interface.

The real product is:

* Persistent company memory
* Evidence tracking
* Decision management
* Experiment engine
* Task prioritization
* Context-aware recommendations

---

# MVP

Build only enough to support one complete loop.

1. Founder enters idea.
2. AI builds structured project profile.
3. AI identifies critical assumptions.
4. Founder interviews customers.
5. AI summarizes evidence.
6. AI creates validation experiments.
7. AI recommends next tasks.
8. Founder launches.
9. Founder earns first dollar.

Everything else can be layered on afterward.

---

# Guiding Principle

**The database remembers.**

**The LLM reasons.**

**The founder decides.**

The product's value comes from continuously helping founders move from **idea to validation to first customer to first dollar**, using accumulated project knowledge rather than isolated conversations.
