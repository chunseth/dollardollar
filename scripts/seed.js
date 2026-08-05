const { pool, transaction } = require("../db");

const owner = process.env.SEED_USER_ID || "local-founder";

(async () => {
  try {
    const project = await transaction(async client => {
      const existing = await client.query("SELECT id FROM projects WHERE user_id=$1 AND name=$2", [owner, "Gradeflow"]);
      const row = existing.rows[0] || (await client.query(
        "INSERT INTO projects (user_id,name,short_description,stage,status,target_customer,problem_statement,solution_summary,revenue_model,pricing_hypothesis,validation_stage,founder_goal,founder_constraints) VALUES ($1,$2,$3,'idea','active',$4,$5,$6,'subscription',$7,'problem_validation',$8,$9) RETURNING id",
        [owner, "Gradeflow", "AI-assisted grading feedback workspace for middle school teachers.", "Middle school teachers", "Grading written homework consumes nights and weekends.", "A workspace that drafts rubric-aligned feedback and class misconception summaries.", "$15/month", "Secure two paid pilots.", "Three customer interviews completed."]
      )).rows[0];
      const projectId = row.id;

      const assumption = (await client.query(
        "INSERT INTO assumptions (project_id,statement,category,priority,confidence,importance,uncertainty,risk_score,revenue_blocker) VALUES ($1,$2,'Willingness to pay','high','low',5,4,85,true) ON CONFLICT DO NOTHING RETURNING id",
        [projectId, "Teachers will personally pay $15/month to reduce grading time."]
      )).rows[0];
      const evidence = (await client.query(
        "INSERT INTO evidence (project_id,source_type,source_title,summary,source_person_name,strength,behavior_vs_opinion) VALUES ($1,'customer_interview',$2,$3,$2,'moderate','stated_intent') ON CONFLICT DO NOTHING RETURNING id",
        [projectId, "Jamie, 8th grade teacher", "Sunday night grading is the most painful part of the week."]
      )).rows[0];
      if (assumption && evidence) {
        await client.query("INSERT INTO assumption_evidence (assumption_id,evidence_id,relationship,explanation) VALUES ($1,$2,'supports',$3) ON CONFLICT DO NOTHING", [assumption.id, evidence.id, "Specific pain supports the grading-time problem."]);
      }
      await client.query("INSERT INTO event_log (project_id,actor_type,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'system','seeded','project',$1,'Seeded Gradeflow demo memory',$2) ON CONFLICT DO NOTHING", [projectId, { owner }]);
      return projectId;
    });
    console.log(`Seed complete for project ${project}.`);
  } finally {
    await pool.end();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
