# Core Data Model

## Purpose

This document defines the high-level data structures for the AI Cofounder product.

The model should help the app answer:

* What is this company?
* What does the founder currently believe?
* What has been validated?
* What is still risky?
* What should happen next?
* Why is the AI recommending that action?

The database is the source of truth. The LLM reads this structure, reasons over it, and proposes updates through validated tools.

---

## 1. Projects

The `projects` structure represents the current company snapshot.

It should describe what the founder is building, who it is for, how it might make money, how hard it may be to sell, and what context the AI needs before making recommendations.

### Core Identity

* id
* user_id
* name
* short_description
* long_description
* tagline
* stage
* status
* created_at
* updated_at

### Market

* industry
* sub_industry
* target_customer
* target_buyer
* target_user
* customer_segment
* geographic_market
* market_size_notes
* competitor_notes

### Problem

* problem_statement
* problem_frequency
* problem_severity
* current_alternatives
* switching_pain
* urgency_level

### Solution

* solution_summary
* product_type
* delivery_model
* core_value_proposition
* primary_use_case
* key_features
* differentiation

Product type examples:

* SaaS
* marketplace
* ecommerce
* service
* agency
* local business
* mobile app
* hardware
* AI tool
* education product
* healthcare product
* fintech product

Delivery model examples:

* web app
* mobile app
* API
* managed service
* physical product
* consulting
* course
* community

### Business Model

* revenue_model
* pricing_hypothesis
* pricing_unit
* expected_average_contract_value
* expected_gross_margin
* payment_timing
* monetization_confidence

Revenue model examples:

* subscription
* usage-based
* transaction fee
* one-time purchase
* services
* licensing
* ads
* affiliate
* freemium

### Sales And Distribution

* sales_motion
* primary_channel
* secondary_channels
* buyer_complexity
* sales_cycle_estimate
* distribution_advantage
* acquisition_strategy
* launch_strategy

Sales motion examples:

* self-serve
* product-led
* founder-led sales
* outbound sales
* enterprise sales
* channel partnerships
* marketplace supply-demand growth
* local direct sales
* community-led

### Risk Profile

* regulatory_risk_level
* technical_risk_level
* market_risk_level
* sales_risk_level
* capital_intensity
* operational_complexity
* trust_requirement
* data_sensitivity
* compliance_notes

Risk levels:

* low
* medium
* high
* unknown

### Validation State

* validation_stage
* validation_summary
* strongest_evidence_summary
* weakest_assumption_summary
* first_revenue_target
* first_revenue_status
* next_major_milestone

Validation stages:

* idea
* problem_validation
* solution_validation
* willingness_to_pay
* mvp_build
* launch
* first_customer
* first_dollar
* repeatable_sales

### AI Context Fields

* founder_goal
* founder_constraints
* recommendation_style
* preferred_task_size
* project_memory_summary
* last_ai_summary

---

## 2. Assumptions

The `assumptions` structure represents beliefs that may be true or false.

Assumptions are the main unit of validation. The product should constantly identify, rank, test, and update them.

### Core Fields

* id
* project_id
* statement
* category
* status
* priority
* confidence
* created_at
* updated_at

### Classification

* category
* subcategory
* source
* owner
* related_project_field

Categories:

* customer
* problem
* solution
* pricing
* willingness_to_pay
* distribution
* sales
* market
* competition
* product
* technical
* regulatory
* operational

Sources:

* founder_claim
* ai_generated
* evidence_derived
* experiment_result
* imported

### Risk And Priority

* importance
* uncertainty
* risk_score
* revenue_blocker
* dependency_level
* urgency

Risk score can be computed from:

* importance
* uncertainty
* impact on first revenue
* amount of supporting evidence
* amount of contradicting evidence

### Validation State

* status
* confidence
* evidence_count
* supporting_evidence_count
* contradicting_evidence_count
* last_tested_at
* validation_notes

Statuses:

* untested
* testing
* supported
* contradicted
* invalidated
* accepted_for_now

### Relationships

* project_id
* parent_assumption_id
* related_decision_id
* related_experiment_ids
* related_evidence_ids

Example:

* Parent assumption: Teachers will pay for grading automation.
* Child assumption: Teachers will pay $15/month.
* Child assumption: Individual teachers can buy without district approval.

---

## 3. Evidence

The `evidence` structure represents market information that supports, weakens, or changes company beliefs.

Evidence should not just be stored as notes. It should be linked to assumptions.

### Core Fields

* id
* project_id
* source_type
* source_title
* summary
* raw_text
* created_at
* updated_at

### Source Details

* source_type
* source_date
* source_url
* source_person_name
* source_person_role
* source_company
* customer_segment
* collection_method

Source types:

* customer_interview
* sales_call
* survey
* landing_page_test
* paid_pilot
* waitlist
* analytics
* competitor_research
* market_research
* founder_note
* uploaded_document

### Evidence Quality

* strength
* confidence
* specificity
* recency
* bias_risk
* willingness_to_pay_signal
* behavior_vs_opinion

Strength examples:

* weak
* moderate
* strong

Behavior vs opinion examples:

* opinion
* stated_intent
* behavior
* payment

### Extracted Insights

* pain_points
* desired_outcomes
* current_alternatives
* buying_triggers
* objections
* price_reactions
* feature_requests
* quotes

### Relationships

* project_id
* related_assumption_ids
* related_experiment_id
* related_task_id
* related_artifact_ids

---

## 4. Assumption Evidence Links

The `assumption_evidence` structure connects evidence to assumptions.

This is where raw information becomes structured learning.

### Core Fields

* id
* project_id
* assumption_id
* evidence_id
* relationship
* strength
* explanation
* created_at

Relationships:

* supports
* contradicts
* mixed
* neutral

### AI Use

The AI should use these links to:

* update assumption confidence
* explain recommendations
* detect contradictions
* identify the next experiment
* summarize what has been learned

---

## 5. Experiments

The `experiments` structure represents a validation test.

Experiments are how assumptions move from belief to evidence.

### Core Fields

* id
* project_id
* assumption_id
* title
* hypothesis
* method
* success_metric
* status
* created_at
* updated_at

### Design

* target_customer
* test_channel
* sample_size_goal
* start_date
* due_date
* cost_estimate
* effort_estimate
* risk_level

Test channel examples:

* interviews
* outbound email
* landing page
* paid ads
* prototype demo
* paid pilot
* concierge MVP
* manual service
* preorder

### Results

* result_summary
* actual_sample_size
* success_count
* failure_count
* conversion_rate
* revenue_collected
* decision
* completed_at

Decisions:

* continue
* iterate
* pivot
* stop
* scale

### Relationships

* project_id
* assumption_id
* related_task_ids
* related_evidence_ids
* resulting_decision_id

---

## 6. Tasks

The `tasks` structure represents concrete execution work.

Tasks are the unit the founder acts on. The recommendation engine should usually output one task.

### Core Fields

* id
* project_id
* title
* description
* status
* priority
* created_at
* updated_at

### Planning

* expected_impact
* estimated_minutes
* difficulty
* due_date
* task_type
* owner
* blocked_by
* recommended_by_ai

Task types:

* interview
* outreach
* research
* build
* write
* launch
* analyze
* follow_up
* admin

### Recommendation Context

* recommendation_reason
* related_assumption_id
* related_experiment_id
* expected_learning
* first_revenue_relevance

### Statuses

* todo
* doing
* done
* skipped
* blocked

---

## 7. Decisions

The `decisions` structure represents founder-approved direction.

Decisions are different from assumptions. Assumptions are uncertain beliefs. Decisions are choices the company is operating under.

### Core Fields

* id
* project_id
* title
* decision
* reason
* status
* decided_at
* created_at
* updated_at

### Classification

* decision_type
* confidence
* reversible
* importance
* owner

Decision types:

* customer
* problem
* solution
* pricing
* positioning
* sales_motion
* product_scope
* technical
* launch
* business_model

### Evidence And Rationale

* evidence_summary
* related_assumption_ids
* related_evidence_ids
* related_experiment_ids

### Statuses

* active
* superseded
* reversed
* archived

---

## 8. Artifacts

The `artifacts` structure represents generated or uploaded work products.

Artifacts are useful outputs, but they should not be confused with memory. They are documents created from memory.

### Core Fields

* id
* project_id
* type
* title
* content
* status
* created_at
* updated_at

### Artifact Types

* interview_script
* interview_summary
* cold_email
* landing_page_copy
* sales_script
* product_spec
* roadmap
* launch_plan
* pricing_page
* competitor_brief
* investor_update

### Generation Context

* prompt_type
* model_used
* source_context_summary
* related_assumption_ids
* related_evidence_ids
* related_decision_ids

### Statuses

* draft
* approved
* used
* archived

---

## 9. Documents

The `documents` structure represents long-form source material for semantic retrieval.

This can be added after the core structured loop works, unless interview transcript ingestion is part of the first MVP.

### Core Fields

* id
* project_id
* title
* source_type
* raw_text
* embedding
* metadata
* created_at
* updated_at

### Chunking

For long documents, use a separate `document_chunks` table.

#### document_chunks

* id
* document_id
* project_id
* chunk_index
* content
* embedding
* metadata
* created_at

### Source Types

* transcript
* notes
* pdf
* web_page
* research
* brainstorm
* competitor_page
* uploaded_file

---

## 10. Events

The `events` structure represents the company timeline.

Events let the AI explain how the project changed over time.

### Core Fields

* id
* project_id
* actor
* event_type
* payload
* created_at

Actors:

* founder
* ai
* system

### Event Types

* project_created
* project_updated
* assumption_created
* assumption_updated
* evidence_added
* evidence_linked
* experiment_created
* experiment_completed
* task_created
* task_completed
* decision_created
* decision_updated
* artifact_created
* recommendation_generated
* milestone_reached
* first_dollar_recorded

### Payload

The payload should store the important change details as JSON.

Example:

```json
{
  "assumption_id": "assumption_123",
  "old_status": "untested",
  "new_status": "testing",
  "reason": "Founder created a paid pilot experiment."
}
```

---

## 11. Recommendations

The `recommendations` structure stores AI-generated next actions.

This lets the app show recommendation history and measure whether the AI is actually helping.

### Core Fields

* id
* project_id
* task_id
* title
* rationale
* status
* created_at
* updated_at

### Ranking Inputs

* related_assumption_id
* related_experiment_id
* expected_impact
* estimated_effort
* urgency
* confidence
* first_revenue_relevance

### Statuses

* proposed
* accepted
* dismissed
* completed

---

## MVP Schema Recommendation

Start with these structures:

* projects
* assumptions
* evidence
* assumption_evidence
* experiments
* tasks
* decisions
* events
* recommendations

Add later:

* artifacts
* documents
* document_chunks

This keeps the first build focused on the validation loop instead of document management.

---

## Example Project Record

```json
{
  "name": "GradeFlow",
  "short_description": "AI grading summaries for middle school teachers.",
  "industry": "education",
  "sub_industry": "K-12",
  "target_customer": "middle school teachers",
  "target_buyer": "individual teachers",
  "target_user": "teachers",
  "product_type": "SaaS",
  "delivery_model": "web app",
  "revenue_model": "subscription",
  "pricing_hypothesis": "$15/month",
  "sales_motion": "founder-led sales",
  "primary_channel": "direct teacher outreach",
  "regulatory_risk_level": "medium",
  "technical_risk_level": "medium",
  "market_risk_level": "high",
  "sales_risk_level": "high",
  "validation_stage": "problem_validation",
  "weakest_assumption_summary": "Teachers will personally pay for grading automation.",
  "next_major_milestone": "Secure three paid pilots."
}
```
