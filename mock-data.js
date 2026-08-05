(function () {
  const now = "2026-08-03T21:00:00.000Z";

  const mockData = {
    currentUser: {
      id: "user_sarah_chen",
      name: "Sarah Chen",
      role: "Founder",
      initials: "SC"
    },

    projects: [
      {
        id: "project_gradeflow",
        user_id: "user_sarah_chen",
        name: "Gradeflow",
        short_description: "AI grading summaries for middle school teachers.",
        long_description:
          "Gradeflow helps middle school teachers turn submitted homework into fast rubric-based summaries, common misconception reports, and reusable feedback snippets.",
        tagline: "Grade homework faster without losing useful feedback.",
        stage: "problem_validation",
        status: "active",
        created_at: "2026-07-28T15:30:00.000Z",
        updated_at: now,

        industry: "education",
        sub_industry: "K-12",
        target_customer: "middle school teachers",
        target_buyer: "individual teachers",
        target_user: "teachers",
        customer_segment: "Grades 6-8 English and social studies teachers",
        geographic_market: "United States",
        market_size_notes:
          "Initial wedge is individual teachers with high grading load. School-level expansion may become relevant after paid pilots.",
        competitor_notes:
          "Current alternatives include manual grading, generic rubrics, Google Classroom comments, and broad AI writing tools.",

        problem_statement:
          "Teachers spend too many evening and weekend hours grading homework while trying to provide useful feedback.",
        problem_frequency: "weekly",
        problem_severity: "high",
        current_alternatives:
          "Manual grading, reusable comment banks, shorter assignments, peer review, and generic AI prompts.",
        switching_pain:
          "Low if the first version works with copied assignment text and does not require school IT approval.",
        urgency_level: "high",

        solution_summary:
          "A web app that summarizes class-wide homework patterns and drafts rubric-aligned feedback teachers can review.",
        product_type: "AI tool",
        delivery_model: "web app",
        core_value_proposition:
          "Save grading time while preserving specific, useful feedback for students.",
        primary_use_case:
          "Paste student responses or assignment exports and receive feedback summaries within minutes.",
        key_features: [
          "Rubric-aligned summary",
          "Common misconception detection",
          "Reusable feedback snippets",
          "Per-class progress notes",
          "Teacher review before anything is sent"
        ],
        differentiation:
          "Focused on teacher workflow and evidence from real assignments, not generic lesson planning or document generation.",

        revenue_model: "subscription",
        pricing_hypothesis: "$15/month",
        pricing_unit: "per teacher",
        expected_average_contract_value: "$180/year",
        expected_gross_margin: "high",
        payment_timing: "monthly",
        monetization_confidence: "low",

        sales_motion: "founder-led sales",
        primary_channel: "direct teacher outreach",
        secondary_channels: ["teacher communities", "referrals", "LinkedIn"],
        buyer_complexity: "low if teacher pays personally, high if school purchase is required",
        sales_cycle_estimate: "1-2 weeks for individual pilots",
        distribution_advantage:
          "Founder has access to former classmates who teach and two local school contacts.",
        acquisition_strategy:
          "Start with direct outreach to 25 middle school teachers and ask for paid pilot conversations.",
        launch_strategy:
          "Run five paid pilot conversations before publishing a public launch page.",

        regulatory_risk_level: "medium",
        technical_risk_level: "medium",
        market_risk_level: "high",
        sales_risk_level: "high",
        capital_intensity: "low",
        operational_complexity: "medium",
        trust_requirement: "high",
        data_sensitivity: "medium",
        compliance_notes:
          "Avoid storing student names or sensitive student data during the first pilot. Require teacher review before use.",

        validation_stage: "problem_validation",
        validation_summary:
          "Three teacher conversations support the grading-time problem, but no payment behavior has been observed.",
        strongest_evidence_summary:
          "Two teachers described grading as a weekly Sunday-night burden and already use shortcuts to reduce feedback time.",
        weakest_assumption_summary:
          "Teachers will personally pay $15/month for grading automation before school approval exists.",
        first_revenue_target: "3 paid teacher pilots at $15/month",
        first_revenue_status: "not_started",
        next_major_milestone: "Ask five teachers to commit to a paid pilot.",

        founder_goal: "Get first paying customer within 30 days.",
        founder_constraints:
          "Can spend 8 hours per week. Wants to avoid complex school procurement for the MVP.",
        recommendation_style: "direct and evidence-based",
        preferred_task_size: "30-60 minutes",
        project_memory_summary:
          "Gradeflow is testing whether middle school teachers with heavy grading loads will pay personally for an AI-assisted feedback workflow.",
        last_ai_summary:
          "Problem pain is supported by interviews. Willingness to pay and buyer authority are still untested."
      }
    ],

    memoryFields: [
      {
        id: "memory_target_customer",
        project_id: "project_gradeflow",
        label: "Target customer",
        value: "middle school teachers",
        source_confidence: "user_confirmed",
        updated_at: "2026-08-01T18:20:00.000Z"
      },
      {
        id: "memory_target_buyer",
        project_id: "project_gradeflow",
        label: "Target buyer",
        value: "individual teachers",
        source_confidence: "llm_inferred",
        updated_at: "2026-08-01T18:20:00.000Z"
      },
      {
        id: "memory_problem",
        project_id: "project_gradeflow",
        label: "Problem",
        value: "Teachers spend too many evening and weekend hours grading homework.",
        source_confidence: "user_confirmed",
        updated_at: "2026-08-02T16:10:00.000Z"
      },
      {
        id: "memory_pricing",
        project_id: "project_gradeflow",
        label: "Pricing hypothesis",
        value: "$15/month per teacher",
        source_confidence: "user_provided",
        updated_at: "2026-08-02T16:10:00.000Z"
      },
      {
        id: "memory_sales_motion",
        project_id: "project_gradeflow",
        label: "Sales motion",
        value: "founder-led sales",
        source_confidence: "llm_inferred",
        updated_at: "2026-08-02T16:10:00.000Z"
      }
    ],

    decisions: [
      {
        id: "decision_001",
        project_id: "project_gradeflow",
        title: "Start with individual teachers",
        decision:
          "Validate with individual middle school teachers before pursuing department or district buyers.",
        reason:
          "Individual teachers are easier to reach and can reveal whether the pain is urgent enough to pay for.",
        status: "active",
        decision_type: "customer",
        confidence: "medium",
        reversible: true,
        importance: "high",
        owner: "founder",
        evidence_summary:
          "Three teacher interviews support the pain, but buyer authority is still unclear.",
        related_assumption_ids: ["assumption_teacher_buyer", "assumption_direct_outreach"],
        related_evidence_ids: ["evidence_001", "evidence_002", "evidence_003"],
        related_experiment_ids: ["experiment_paid_pilot"],
        decided_at: "2026-08-01T18:30:00.000Z",
        created_at: "2026-08-01T18:30:00.000Z",
        updated_at: "2026-08-01T18:30:00.000Z"
      },
      {
        id: "decision_002",
        project_id: "project_gradeflow",
        title: "Avoid student-identifiable data in MVP",
        decision:
          "The first pilot will use anonymized assignment samples and teacher-reviewed outputs only.",
        reason:
          "This lowers trust and compliance risk while testing the core workflow.",
        status: "active",
        decision_type: "technical",
        confidence: "high",
        reversible: false,
        importance: "high",
        owner: "founder",
        evidence_summary:
          "Teacher concerns about school approval and student data appeared in two conversations.",
        related_assumption_ids: ["assumption_data_safety"],
        related_evidence_ids: ["evidence_002", "evidence_004"],
        related_experiment_ids: ["experiment_concierge_demo"],
        decided_at: "2026-08-02T11:00:00.000Z",
        created_at: "2026-08-02T11:00:00.000Z",
        updated_at: "2026-08-02T11:00:00.000Z"
      }
    ],

    assumptions: [
      {
        id: "assumption_pay_15",
        project_id: "project_gradeflow",
        statement: "Teachers will personally pay $15/month for grading automation.",
        category: "willingness_to_pay",
        subcategory: "pricing",
        source: "ai_generated",
        owner: "founder",
        related_project_field: "pricing_hypothesis",
        status: "untested",
        priority: "critical",
        confidence: "low",
        importance: 5,
        uncertainty: 5,
        evidence_strength: 0,
        revenue_impact: 5,
        dependency_level: 5,
        urgency: 5,
        risk_score: 100,
        revenue_blocker: true,
        evidence_count: 1,
        supporting_evidence_count: 0,
        contradicting_evidence_count: 0,
        last_tested_at: null,
        validation_notes:
          "Interviewees expressed pain but no one has been asked to pay yet.",
        created_at: "2026-08-01T18:25:00.000Z",
        updated_at: now
      },
      {
        id: "assumption_grading_pain",
        project_id: "project_gradeflow",
        statement: "Middle school teachers experience grading as a frequent, high-severity problem.",
        category: "problem",
        subcategory: "pain_frequency",
        source: "evidence_derived",
        owner: "founder",
        related_project_field: "problem_statement",
        status: "supported",
        priority: "high",
        confidence: "medium",
        importance: 5,
        uncertainty: 2,
        evidence_strength: 3,
        revenue_impact: 4,
        dependency_level: 4,
        urgency: 4,
        risk_score: 56,
        revenue_blocker: true,
        evidence_count: 3,
        supporting_evidence_count: 3,
        contradicting_evidence_count: 0,
        last_tested_at: "2026-08-02T16:00:00.000Z",
        validation_notes:
          "Three interviews point to repeated grading pain, especially after longer writing assignments.",
        created_at: "2026-08-01T18:25:00.000Z",
        updated_at: "2026-08-02T16:15:00.000Z"
      },
      {
        id: "assumption_teacher_buyer",
        project_id: "project_gradeflow",
        statement: "Individual teachers can buy and use the product without district approval.",
        category: "buyer_and_sales",
        subcategory: "buyer_authority",
        source: "ai_generated",
        owner: "founder",
        related_project_field: "target_buyer",
        status: "untested",
        priority: "critical",
        confidence: "low",
        importance: 5,
        uncertainty: 4,
        evidence_strength: 1,
        revenue_impact: 5,
        dependency_level: 5,
        urgency: 4,
        risk_score: 84,
        revenue_blocker: true,
        evidence_count: 2,
        supporting_evidence_count: 0,
        contradicting_evidence_count: 1,
        last_tested_at: null,
        validation_notes:
          "Two teachers raised school approval concerns. The pilot must avoid regulated workflows.",
        created_at: "2026-08-01T18:25:00.000Z",
        updated_at: now
      },
      {
        id: "assumption_direct_outreach",
        project_id: "project_gradeflow",
        statement: "Direct outreach can generate five qualified paid pilot conversations.",
        category: "distribution",
        subcategory: "founder_led_sales",
        source: "ai_generated",
        owner: "founder",
        related_project_field: "primary_channel",
        status: "testing",
        priority: "high",
        confidence: "low",
        importance: 4,
        uncertainty: 4,
        evidence_strength: 1,
        revenue_impact: 5,
        dependency_level: 4,
        urgency: 5,
        risk_score: 78,
        revenue_blocker: true,
        evidence_count: 1,
        supporting_evidence_count: 1,
        contradicting_evidence_count: 0,
        last_tested_at: "2026-08-03T14:00:00.000Z",
        validation_notes:
          "Founder has a warm list of 18 teachers but has not tested conversion to paid pilot calls.",
        created_at: "2026-08-01T18:25:00.000Z",
        updated_at: now
      },
      {
        id: "assumption_feedback_quality",
        project_id: "project_gradeflow",
        statement: "Teachers will trust AI-drafted feedback if they can review and edit it first.",
        category: "solution",
        subcategory: "trust",
        source: "evidence_derived",
        owner: "founder",
        related_project_field: "core_value_proposition",
        status: "testing",
        priority: "medium",
        confidence: "medium",
        importance: 4,
        uncertainty: 3,
        evidence_strength: 2,
        revenue_impact: 4,
        dependency_level: 3,
        urgency: 3,
        risk_score: 50,
        revenue_blocker: false,
        evidence_count: 2,
        supporting_evidence_count: 1,
        contradicting_evidence_count: 1,
        last_tested_at: "2026-08-02T16:00:00.000Z",
        validation_notes:
          "Teachers liked summary help but were wary of anything sent directly to students.",
        created_at: "2026-08-01T18:25:00.000Z",
        updated_at: now
      },
      {
        id: "assumption_data_safety",
        project_id: "project_gradeflow",
        statement: "The MVP can avoid storing sensitive student data while still being useful.",
        category: "regulatory_and_trust",
        subcategory: "data_sensitivity",
        source: "founder_claim",
        owner: "founder",
        related_project_field: "data_sensitivity",
        status: "accepted_for_now",
        priority: "high",
        confidence: "medium",
        importance: 5,
        uncertainty: 3,
        evidence_strength: 2,
        revenue_impact: 4,
        dependency_level: 4,
        urgency: 4,
        risk_score: 62,
        revenue_blocker: true,
        evidence_count: 2,
        supporting_evidence_count: 1,
        contradicting_evidence_count: 0,
        last_tested_at: "2026-08-02T11:00:00.000Z",
        validation_notes:
          "Use anonymized samples in concierge pilots. Revisit before real classroom integrations.",
        created_at: "2026-08-02T11:00:00.000Z",
        updated_at: now
      }
    ],

    evidence: [
      {
        id: "evidence_001",
        project_id: "project_gradeflow",
        source_type: "customer_interview",
        source_title: "Interview with 7th grade English teacher",
        source_date: "2026-07-31",
        source_url: null,
        source_person_name: "Maya R.",
        source_person_role: "7th grade English teacher",
        source_company: "Public middle school",
        customer_segment: "Grades 6-8 English",
        collection_method: "30-minute Zoom call",
        summary:
          "Maya spends 4-6 hours grading after essay assignments and already uses reusable comment banks to save time.",
        raw_text:
          "The hardest part is Sunday night. I want students to get specific feedback, but by the 40th paper I am just trying to finish.",
        strength: "strong",
        confidence: "medium",
        specificity: "high",
        recency: "high",
        bias_risk: "medium",
        willingness_to_pay_signal: "none",
        behavior_vs_opinion: "repeated_painful_behavior",
        sentiment: "positive",
        pain_points: ["Sunday grading load", "repetitive comments", "feedback quality drops over time"],
        desired_outcomes: ["finish faster", "keep feedback specific", "see class-wide patterns"],
        current_alternatives: ["comment banks", "shorter assignments"],
        buying_triggers: ["essay unit", "end of quarter"],
        objections: ["student privacy", "AI accuracy"],
        price_reactions: [],
        feature_requests: ["common misconception summary", "editable feedback snippets"],
        quotes: [
          "By the 40th paper I am just trying to finish.",
          "I would never want feedback sent without me reviewing it."
        ],
        related_assumption_ids: [
          "assumption_grading_pain",
          "assumption_feedback_quality",
          "assumption_data_safety"
        ],
        related_experiment_id: null,
        related_task_id: "task_interview_3_teachers",
        related_artifact_ids: [],
        created_at: "2026-07-31T21:00:00.000Z",
        updated_at: "2026-07-31T21:00:00.000Z"
      },
      {
        id: "evidence_002",
        project_id: "project_gradeflow",
        source_type: "customer_interview",
        source_title: "Interview with 6th grade social studies teacher",
        source_date: "2026-08-01",
        source_url: null,
        source_person_name: "Jordan P.",
        source_person_role: "6th grade social studies teacher",
        source_company: "Charter middle school",
        customer_segment: "Grades 6-8 humanities",
        collection_method: "Phone call",
        summary:
          "Jordan wants faster formative feedback but is unsure whether school policy allows uploading student work to outside tools.",
        raw_text:
          "I would try it on anonymized samples. Anything with student names probably needs admin approval.",
        strength: "moderate",
        confidence: "medium",
        specificity: "medium",
        recency: "high",
        bias_risk: "medium",
        willingness_to_pay_signal: "stated_interest",
        behavior_vs_opinion: "stated_intent",
        sentiment: "mixed",
        pain_points: ["grading short responses", "tracking misconceptions"],
        desired_outcomes: ["faster formative feedback", "class trend summaries"],
        current_alternatives: ["Google Classroom comments", "manual spreadsheet"],
        buying_triggers: ["benchmark assessment", "large writing assignment"],
        objections: ["approval", "student data"],
        price_reactions: ["Said $15/month is plausible if it saves hours weekly."],
        feature_requests: ["anonymized mode", "copy-paste workflow"],
        quotes: [
          "Anything with student names probably needs admin approval.",
          "$15 is not crazy if it actually saves me a few hours."
        ],
        related_assumption_ids: [
          "assumption_pay_15",
          "assumption_teacher_buyer",
          "assumption_data_safety"
        ],
        related_experiment_id: null,
        related_task_id: "task_interview_3_teachers",
        related_artifact_ids: [],
        created_at: "2026-08-01T20:30:00.000Z",
        updated_at: "2026-08-01T20:30:00.000Z"
      },
      {
        id: "evidence_003",
        project_id: "project_gradeflow",
        source_type: "customer_interview",
        source_title: "Interview with 8th grade ELA teacher",
        source_date: "2026-08-02",
        source_url: null,
        source_person_name: "Lena T.",
        source_person_role: "8th grade ELA teacher",
        source_company: "Public middle school",
        customer_segment: "Grades 6-8 English",
        collection_method: "In-person coffee chat",
        summary:
          "Lena grades writing every week and said a class-wide misconception summary would be more valuable than polished individual comments.",
        raw_text:
          "I need to know what to reteach tomorrow. Individual comments matter, but the class pattern is what changes my lesson plan.",
        strength: "strong",
        confidence: "medium",
        specificity: "high",
        recency: "high",
        bias_risk: "low",
        willingness_to_pay_signal: "scheduled_follow_up",
        behavior_vs_opinion: "scheduled_commitment",
        sentiment: "positive",
        pain_points: ["reteaching decisions", "grading volume", "feedback fatigue"],
        desired_outcomes: ["class-wide patterns", "faster next-day planning"],
        current_alternatives: ["skim papers", "mental notes", "rubric totals"],
        buying_triggers: ["weekly writing cycle"],
        objections: ["accuracy", "setup time"],
        price_reactions: ["Asked to see a pilot workflow before discussing price."],
        feature_requests: ["misconception report", "rubric summary"],
        quotes: [
          "The class pattern is what changes my lesson plan.",
          "I would look at a demo if it used my assignment."
        ],
        related_assumption_ids: [
          "assumption_grading_pain",
          "assumption_feedback_quality",
          "assumption_direct_outreach"
        ],
        related_experiment_id: "experiment_concierge_demo",
        related_task_id: "task_schedule_demo_lena",
        related_artifact_ids: [],
        created_at: "2026-08-02T16:00:00.000Z",
        updated_at: "2026-08-02T16:00:00.000Z"
      },
      {
        id: "evidence_004",
        project_id: "project_gradeflow",
        source_type: "competitor_research",
        source_title: "Review of generic AI grading tools",
        source_date: "2026-08-02",
        source_url: null,
        source_person_name: null,
        source_person_role: null,
        source_company: null,
        customer_segment: "Education software",
        collection_method: "Manual web research",
        summary:
          "Most alternatives focus on assignment generation or generic grading, not teacher-controlled class pattern analysis.",
        raw_text:
          "Competitors often promise automated grading, which may increase trust concerns. Few highlight teacher review or anonymized workflows.",
        strength: "weak",
        confidence: "low",
        specificity: "medium",
        recency: "high",
        bias_risk: "high",
        willingness_to_pay_signal: "none",
        behavior_vs_opinion: "research",
        sentiment: "neutral",
        pain_points: [],
        desired_outcomes: [],
        current_alternatives: ["generic AI tools", "rubric graders", "lesson planning platforms"],
        buying_triggers: [],
        objections: ["trust", "data handling"],
        price_reactions: [],
        feature_requests: [],
        quotes: [],
        related_assumption_ids: [
          "assumption_feedback_quality",
          "assumption_data_safety"
        ],
        related_experiment_id: null,
        related_task_id: "task_competitor_scan",
        related_artifact_ids: [],
        created_at: "2026-08-02T19:10:00.000Z",
        updated_at: "2026-08-02T19:10:00.000Z"
      },
      {
        id: "evidence_005",
        project_id: "project_gradeflow",
        source_type: "manual_note",
        source_title: "Warm outreach list built",
        source_date: "2026-08-03",
        source_url: null,
        source_person_name: null,
        source_person_role: null,
        source_company: null,
        customer_segment: "Middle school teachers",
        collection_method: "Founder note",
        summary:
          "Founder identified 18 warm teacher contacts and 7 second-degree contacts for pilot outreach.",
        raw_text:
          "List includes 8 ELA teachers, 4 social studies teachers, 3 science teachers, and 3 instructional coaches.",
        strength: "moderate",
        confidence: "high",
        specificity: "high",
        recency: "high",
        bias_risk: "low",
        willingness_to_pay_signal: "none",
        behavior_vs_opinion: "founder_asset",
        sentiment: "positive",
        pain_points: [],
        desired_outcomes: [],
        current_alternatives: [],
        buying_triggers: [],
        objections: [],
        price_reactions: [],
        feature_requests: [],
        quotes: [],
        related_assumption_ids: ["assumption_direct_outreach"],
        related_experiment_id: "experiment_paid_pilot",
        related_task_id: "task_send_paid_pilot_asks",
        related_artifact_ids: ["artifact_paid_pilot_script"],
        created_at: "2026-08-03T14:00:00.000Z",
        updated_at: "2026-08-03T14:00:00.000Z"
      }
    ],

    assumptionEvidence: [
      {
        id: "assumption_evidence_001",
        project_id: "project_gradeflow",
        assumption_id: "assumption_grading_pain",
        evidence_id: "evidence_001",
        relationship: "supports",
        strength: "strong",
        explanation:
          "The teacher described repeated weekly grading pain and existing workaround behavior.",
        created_at: "2026-07-31T21:05:00.000Z"
      },
      {
        id: "assumption_evidence_002",
        project_id: "project_gradeflow",
        assumption_id: "assumption_pay_15",
        evidence_id: "evidence_002",
        relationship: "neutral",
        strength: "weak",
        explanation:
          "The teacher said the price sounded plausible, but no payment or commitment was requested.",
        created_at: "2026-08-01T20:35:00.000Z"
      },
      {
        id: "assumption_evidence_003",
        project_id: "project_gradeflow",
        assumption_id: "assumption_teacher_buyer",
        evidence_id: "evidence_002",
        relationship: "contradicts",
        strength: "moderate",
        explanation:
          "The teacher raised approval concerns for any workflow involving identifiable student work.",
        created_at: "2026-08-01T20:35:00.000Z"
      },
      {
        id: "assumption_evidence_004",
        project_id: "project_gradeflow",
        assumption_id: "assumption_grading_pain",
        evidence_id: "evidence_003",
        relationship: "supports",
        strength: "strong",
        explanation:
          "The teacher has weekly writing grading pain and wants faster class pattern analysis.",
        created_at: "2026-08-02T16:05:00.000Z"
      },
      {
        id: "assumption_evidence_005",
        project_id: "project_gradeflow",
        assumption_id: "assumption_feedback_quality",
        evidence_id: "evidence_003",
        relationship: "supports",
        strength: "moderate",
        explanation:
          "The teacher agreed to review a demo using her assignment, suggesting review-first AI help may be trusted.",
        created_at: "2026-08-02T16:05:00.000Z"
      },
      {
        id: "assumption_evidence_006",
        project_id: "project_gradeflow",
        assumption_id: "assumption_data_safety",
        evidence_id: "evidence_004",
        relationship: "supports",
        strength: "weak",
        explanation:
          "Competitor messaging suggests anonymized, teacher-controlled workflows may be a useful trust differentiator.",
        created_at: "2026-08-02T19:15:00.000Z"
      },
      {
        id: "assumption_evidence_007",
        project_id: "project_gradeflow",
        assumption_id: "assumption_direct_outreach",
        evidence_id: "evidence_005",
        relationship: "supports",
        strength: "moderate",
        explanation:
          "The founder has enough warm contacts to test whether direct outreach can generate pilot conversations.",
        created_at: "2026-08-03T14:05:00.000Z"
      }
    ],

    experiments: [
      {
        id: "experiment_paid_pilot",
        project_id: "project_gradeflow",
        assumption_id: "assumption_pay_15",
        title: "Ask five teachers for a paid pilot",
        hypothesis:
          "At least three middle school teachers will agree to a $15/month pilot if the product saves grading time.",
        method:
          "Send warm outreach messages, book short calls, and ask directly for a paid pilot commitment.",
        success_metric: "3 paid pilot commitments from 5 conversations",
        status: "running",
        target_customer: "Middle school ELA and social studies teachers",
        test_channel: "direct outreach",
        sample_size_goal: 5,
        start_date: "2026-08-03",
        due_date: "2026-08-09",
        cost_estimate: "$0",
        effort_estimate: "3 hours",
        risk_level: "high",
        result_summary: null,
        actual_sample_size: 0,
        success_count: 0,
        failure_count: 0,
        conversion_rate: null,
        revenue_collected: "$0",
        decision: null,
        related_task_ids: [
          "task_send_paid_pilot_asks",
          "task_follow_up_paid_pilot",
          "task_record_pilot_results"
        ],
        related_evidence_ids: ["evidence_005"],
        resulting_decision_id: null,
        created_at: "2026-08-03T14:15:00.000Z",
        updated_at: now
      },
      {
        id: "experiment_concierge_demo",
        project_id: "project_gradeflow",
        assumption_id: "assumption_feedback_quality",
        title: "Run a concierge grading summary demo",
        hypothesis:
          "A teacher will find a manually prepared AI-assisted class summary useful enough to request another run.",
        method:
          "Use anonymized sample work from one teacher and manually produce a class misconception report.",
        success_metric: "Teacher asks to use the workflow on another assignment",
        status: "proposed",
        target_customer: "8th grade ELA teacher",
        test_channel: "prototype demo",
        sample_size_goal: 1,
        start_date: null,
        due_date: "2026-08-07",
        cost_estimate: "$0",
        effort_estimate: "2 hours",
        risk_level: "medium",
        result_summary: null,
        actual_sample_size: 0,
        success_count: 0,
        failure_count: 0,
        conversion_rate: null,
        revenue_collected: "$0",
        decision: null,
        related_task_ids: ["task_schedule_demo_lena", "task_prepare_demo"],
        related_evidence_ids: ["evidence_003"],
        resulting_decision_id: null,
        created_at: "2026-08-02T16:20:00.000Z",
        updated_at: now
      },
      {
        id: "experiment_problem_interviews",
        project_id: "project_gradeflow",
        assumption_id: "assumption_grading_pain",
        title: "Interview three middle school teachers",
        hypothesis:
          "Teachers will describe grading as a frequent and severe pain without being led.",
        method:
          "Conduct three discovery interviews focused on recent grading behavior and current workarounds.",
        success_metric: "At least two teachers describe repeated painful grading behavior",
        status: "completed",
        target_customer: "Middle school teachers",
        test_channel: "interviews",
        sample_size_goal: 3,
        start_date: "2026-07-31",
        due_date: "2026-08-02",
        cost_estimate: "$18 coffee",
        effort_estimate: "3 hours",
        risk_level: "medium",
        result_summary:
          "All three teachers described recurring grading pain. Two had clear current workarounds.",
        actual_sample_size: 3,
        success_count: 3,
        failure_count: 0,
        conversion_rate: 1,
        revenue_collected: "$0",
        decision: "continue",
        related_task_ids: ["task_interview_3_teachers"],
        related_evidence_ids: ["evidence_001", "evidence_002", "evidence_003"],
        resulting_decision_id: "decision_001",
        created_at: "2026-07-31T15:00:00.000Z",
        updated_at: "2026-08-02T16:20:00.000Z"
      }
    ],

    tasks: [
      {
        id: "task_send_paid_pilot_asks",
        project_id: "project_gradeflow",
        experiment_id: "experiment_paid_pilot",
        title: "Ask five teachers for a $15 paid pilot",
        description:
          "Send the paid pilot message to five warm teacher contacts and ask for a 15-minute call.",
        status: "todo",
        priority: "critical",
        expected_impact: "high",
        estimated_minutes: 45,
        difficulty: "medium",
        due_date: "2026-08-04",
        task_type: "outreach",
        owner: "founder",
        blocked_by: null,
        recommended_by_ai: true,
        recommendation_reason:
          "This directly tests the riskiest revenue-blocking assumption: willingness to pay.",
        related_assumption_id: "assumption_pay_15",
        related_experiment_id: "experiment_paid_pilot",
        expected_learning:
          "Whether teachers will move from interest to a paid commitment.",
        first_revenue_relevance: "direct",
        created_at: "2026-08-03T14:20:00.000Z",
        updated_at: now
      },
      {
        id: "task_follow_up_paid_pilot",
        project_id: "project_gradeflow",
        experiment_id: "experiment_paid_pilot",
        title: "Follow up with non-responders",
        description:
          "Send a short follow-up to teachers who do not respond within 48 hours.",
        status: "upcoming",
        priority: "high",
        expected_impact: "medium",
        estimated_minutes: 20,
        difficulty: "low",
        due_date: "2026-08-06",
        task_type: "follow_up",
        owner: "founder",
        blocked_by: "task_send_paid_pilot_asks",
        recommended_by_ai: true,
        recommendation_reason:
          "Follow-up improves the direct outreach experiment without adding new complexity.",
        related_assumption_id: "assumption_direct_outreach",
        related_experiment_id: "experiment_paid_pilot",
        expected_learning:
          "Whether lack of response is timing-related or a weak signal of demand.",
        first_revenue_relevance: "direct",
        created_at: "2026-08-03T14:20:00.000Z",
        updated_at: now
      },
      {
        id: "task_schedule_demo_lena",
        project_id: "project_gradeflow",
        experiment_id: "experiment_concierge_demo",
        title: "Schedule Lena's concierge demo",
        description:
          "Book a demo slot and ask Lena to share one anonymized assignment sample.",
        status: "todo",
        priority: "high",
        expected_impact: "medium",
        estimated_minutes: 15,
        difficulty: "low",
        due_date: "2026-08-05",
        task_type: "outreach",
        owner: "founder",
        blocked_by: null,
        recommended_by_ai: false,
        recommendation_reason:
          "This tests whether the teacher-reviewed workflow creates enough value for continued use.",
        related_assumption_id: "assumption_feedback_quality",
        related_experiment_id: "experiment_concierge_demo",
        expected_learning:
          "Whether class-wide summaries are more valuable than individual comment drafting.",
        first_revenue_relevance: "indirect",
        created_at: "2026-08-02T16:25:00.000Z",
        updated_at: now
      },
      {
        id: "task_prepare_demo",
        project_id: "project_gradeflow",
        experiment_id: "experiment_concierge_demo",
        title: "Prepare anonymized grading summary demo",
        description:
          "Create a one-page class pattern summary from anonymized sample responses.",
        status: "blocked",
        priority: "medium",
        expected_impact: "medium",
        estimated_minutes: 60,
        difficulty: "medium",
        due_date: "2026-08-07",
        task_type: "build",
        owner: "founder",
        blocked_by: "task_schedule_demo_lena",
        recommended_by_ai: false,
        recommendation_reason:
          "Demo work should happen after the teacher provides a real sample assignment.",
        related_assumption_id: "assumption_feedback_quality",
        related_experiment_id: "experiment_concierge_demo",
        expected_learning:
          "Whether a lightweight manual version is enough to validate the solution.",
        first_revenue_relevance: "indirect",
        created_at: "2026-08-02T16:25:00.000Z",
        updated_at: now
      },
      {
        id: "task_record_pilot_results",
        project_id: "project_gradeflow",
        experiment_id: "experiment_paid_pilot",
        title: "Record paid pilot outcomes",
        description:
          "After outreach calls, record who said yes, no, maybe, and why.",
        status: "upcoming",
        priority: "high",
        expected_impact: "high",
        estimated_minutes: 30,
        difficulty: "low",
        due_date: "2026-08-09",
        task_type: "analyze",
        owner: "founder",
        blocked_by: "task_send_paid_pilot_asks",
        recommended_by_ai: true,
        recommendation_reason:
          "The product needs payment evidence before updating assumption confidence.",
        related_assumption_id: "assumption_pay_15",
        related_experiment_id: "experiment_paid_pilot",
        expected_learning:
          "Whether willingness to pay is supported, contradicted, or still unclear.",
        first_revenue_relevance: "direct",
        created_at: "2026-08-03T14:20:00.000Z",
        updated_at: now
      },
      {
        id: "task_interview_3_teachers",
        project_id: "project_gradeflow",
        experiment_id: "experiment_problem_interviews",
        title: "Interview three teachers about grading pain",
        description:
          "Complete three discovery interviews and summarize current workarounds.",
        status: "done",
        priority: "high",
        expected_impact: "high",
        estimated_minutes: 180,
        difficulty: "medium",
        due_date: "2026-08-02",
        task_type: "interview",
        owner: "founder",
        blocked_by: null,
        recommended_by_ai: true,
        recommendation_reason:
          "Problem validation was needed before testing paid pilots.",
        related_assumption_id: "assumption_grading_pain",
        related_experiment_id: "experiment_problem_interviews",
        expected_learning:
          "Whether grading pain is frequent and severe enough to keep testing.",
        first_revenue_relevance: "indirect",
        created_at: "2026-07-31T15:10:00.000Z",
        updated_at: "2026-08-02T16:20:00.000Z"
      },
      {
        id: "task_competitor_scan",
        project_id: "project_gradeflow",
        experiment_id: null,
        title: "Scan five AI grading alternatives",
        description:
          "Compare messaging, trust claims, and pricing for existing tools.",
        status: "done",
        priority: "medium",
        expected_impact: "medium",
        estimated_minutes: 45,
        difficulty: "low",
        due_date: "2026-08-02",
        task_type: "research",
        owner: "founder",
        blocked_by: null,
        recommended_by_ai: false,
        recommendation_reason:
          "Competitor research helps position the concierge demo and outreach copy.",
        related_assumption_id: "assumption_feedback_quality",
        related_experiment_id: null,
        expected_learning:
          "Whether there is a clear differentiated wedge around teacher review and class patterns.",
        first_revenue_relevance: "indirect",
        created_at: "2026-08-02T18:00:00.000Z",
        updated_at: "2026-08-02T19:10:00.000Z"
      }
    ],

    recommendations: [
      {
        id: "recommendation_001",
        project_id: "project_gradeflow",
        task_id: "task_send_paid_pilot_asks",
        title: "Ask five teachers for a $15 paid pilot",
        rationale:
          "Your strongest evidence supports the grading problem, but your riskiest assumption is still payment. Asking for a paid pilot creates the fastest learning path toward first revenue.",
        status: "proposed",
        related_assumption_id: "assumption_pay_15",
        related_experiment_id: "experiment_paid_pilot",
        expected_impact: "high",
        estimated_effort: "45 minutes",
        urgency: "high",
        confidence: "medium",
        first_revenue_relevance: "direct",
        created_at: "2026-08-03T21:00:00.000Z",
        updated_at: "2026-08-03T21:00:00.000Z"
      },
      {
        id: "recommendation_002",
        project_id: "project_gradeflow",
        task_id: "task_schedule_demo_lena",
        title: "Schedule one concierge demo",
        rationale:
          "A teacher has already agreed to look at a demo. This can test the workflow, but it is secondary to testing payment.",
        status: "snoozed",
        related_assumption_id: "assumption_feedback_quality",
        related_experiment_id: "experiment_concierge_demo",
        expected_impact: "medium",
        estimated_effort: "15 minutes",
        urgency: "medium",
        confidence: "medium",
        first_revenue_relevance: "indirect",
        created_at: "2026-08-03T18:00:00.000Z",
        updated_at: "2026-08-03T20:00:00.000Z"
      }
    ],

    artifacts: [
      {
        id: "artifact_paid_pilot_script",
        project_id: "project_gradeflow",
        type: "sales_script",
        title: "Paid pilot outreach script",
        content:
          "I am testing a small tool that helps teachers turn student responses into a quick class-wide grading summary. Would you be open to a 15-minute call this week? I am looking for 3 teachers willing to try a $15 pilot if it looks useful.",
        status: "draft",
        prompt_type: "outreach",
        model_used: null,
        source_context_summary:
          "Uses teacher grading pain, $15/month pricing hypothesis, and paid pilot experiment.",
        related_assumption_ids: ["assumption_pay_15", "assumption_direct_outreach"],
        related_evidence_ids: ["evidence_001", "evidence_002", "evidence_003"],
        related_decision_ids: ["decision_001"],
        created_at: "2026-08-03T14:25:00.000Z",
        updated_at: "2026-08-03T14:25:00.000Z"
      }
    ],

    events: [
      {
        id: "event_001",
        project_id: "project_gradeflow",
        actor: "founder",
        event_type: "project_created",
        payload: {
          project_id: "project_gradeflow",
          name: "Gradeflow",
          source: "idea_intake"
        },
        created_at: "2026-07-28T15:30:00.000Z"
      },
      {
        id: "event_002",
        project_id: "project_gradeflow",
        actor: "ai",
        event_type: "assumption_created",
        payload: {
          assumption_id: "assumption_pay_15",
          priority: "critical",
          reason: "Revenue cannot happen until willingness to pay is tested."
        },
        created_at: "2026-08-01T18:25:00.000Z"
      },
      {
        id: "event_003",
        project_id: "project_gradeflow",
        actor: "founder",
        event_type: "decision_created",
        payload: {
          decision_id: "decision_001",
          title: "Start with individual teachers"
        },
        created_at: "2026-08-01T18:30:00.000Z"
      },
      {
        id: "event_004",
        project_id: "project_gradeflow",
        actor: "founder",
        event_type: "evidence_added",
        payload: {
          evidence_id: "evidence_003",
          source_type: "customer_interview",
          source_title: "Interview with 8th grade ELA teacher"
        },
        created_at: "2026-08-02T16:00:00.000Z"
      },
      {
        id: "event_005",
        project_id: "project_gradeflow",
        actor: "ai",
        event_type: "evidence_linked",
        payload: {
          evidence_id: "evidence_003",
          assumption_ids: ["assumption_grading_pain", "assumption_feedback_quality"]
        },
        created_at: "2026-08-02T16:05:00.000Z"
      },
      {
        id: "event_006",
        project_id: "project_gradeflow",
        actor: "system",
        event_type: "experiment_completed",
        payload: {
          experiment_id: "experiment_problem_interviews",
          result: "3 of 3 interviews supported grading pain"
        },
        created_at: "2026-08-02T16:20:00.000Z"
      },
      {
        id: "event_007",
        project_id: "project_gradeflow",
        actor: "ai",
        event_type: "recommendation_generated",
        payload: {
          recommendation_id: "recommendation_001",
          task_id: "task_send_paid_pilot_asks",
          related_assumption_id: "assumption_pay_15"
        },
        created_at: "2026-08-03T21:00:00.000Z"
      },
      {
        id: "event_008",
        project_id: "project_gradeflow",
        actor: "system",
        event_type: "milestone_reached",
        payload: {
          milestone: "problem_validation",
          summary: "Problem pain supported by three interviews."
        },
        created_at: "2026-08-03T21:00:00.000Z"
      }
    ],

    ideaIntake: {
      prompt:
        "What are you building, who is it for, and what progress have you made so far?",
      founder_input:
        "I am building an AI tool that helps middle school teachers grade homework faster. I have talked to three teachers and they all complained about grading taking too long. I think teachers might pay $15/month if it saves a few hours each week.",
      extracted_preview: {
        target_customer: "middle school teachers",
        target_buyer: "individual teachers",
        problem_statement:
          "Teachers spend too many evening and weekend hours grading homework.",
        solution_summary:
          "AI-assisted grading summaries and editable feedback snippets.",
        pricing_hypothesis: "$15/month",
        revenue_model: "subscription",
        sales_motion: "founder-led sales",
        first_revenue_target: "3 paid teacher pilots at $15/month"
      },
      confirmation_required: [
        "target_buyer",
        "pricing_hypothesis",
        "revenue_model",
        "sales_motion",
        "first_revenue_target"
      ]
    },

    dashboardState: {
      active_project_id: "project_gradeflow",
      primary_recommendation_id: "recommendation_001",
      active_experiment_id: "experiment_paid_pilot",
      riskiest_assumption_id: "assumption_pay_15",
      first_revenue_progress: {
        target: "3 paid pilots",
        current_count: 0,
        target_count: 3,
        revenue_collected: "$0",
        status: "not_started"
      },
      counts: {
        open_tasks: 5,
        critical_assumptions: 2,
        evidence_items: 5,
        active_experiments: 1
      }
    }
  };

  if (typeof window !== "undefined") {
    window.firstDollarMockData = mockData;
  }

  if (typeof module !== "undefined") {
    module.exports = mockData;
  }
})();
