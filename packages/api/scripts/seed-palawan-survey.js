// Builds the Coral Restoration Survey on demo-palawan.
//
// The form is snapshots/palawan-coral-survey, taken from the public Palawan
// Corals survey. It keeps the one sector (Coral Recovery Priority Areas), the
// shape questions, and the "other" show rules. Basemaps are the project's
// Light and Satellite styles, not the production basemap ids.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SLUG = "demo-palawan";
const SURVEY_NAME = "Coral Restoration Survey";

function loadSurvey() {
  const file = path.join(
    __dirname,
    "../snapshots/palawan-coral-survey/survey.json"
  );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sqlOperator(operator) {
  if (operator === "EQUAL") return "=";
  if (operator === "IS_BLANK") return "is blank";
  if (operator === "CONTAINS") return "contains";
  throw new Error(`Unknown form logic operator ${operator}`);
}

function jsonb(value) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

async function insertElement(client, formId, element) {
  const result = await client.query(
    `insert into form_elements (
       form_id, is_required, export_id, component_settings, type_id, body,
       layout, alternate_language_settings
     ) values (
       $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, '{}'::jsonb
     ) returning id`,
    [
      formId,
      !!element.isRequired,
      element.exportId || null,
      jsonb(element.componentSettings || {}),
      element.typeId,
      jsonb(element.body),
      element.layout || null,
    ]
  );
  return result.rows[0].id;
}

async function main() {
  const connectionString = process.env.SOURCE_URL;
  if (!connectionString) {
    console.error("SOURCE_URL is required.");
    process.exit(1);
  }

  const survey = loadSurvey();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `select
         set_config('session.user_id', (select id::text from users where sub = 'e2e|admin'), true),
         set_config('session.canonical_email', 'admin@example.test', true),
         set_config('session.email_verified', 'true', true)`
    );

    const project = await client.query(`select id from projects where slug = $1`, [
      SLUG,
    ]);
    if (project.rowCount !== 1) {
      throw new Error(`${SLUG} is missing`);
    }
    const projectId = project.rows[0].id;

    await client.query(
      `insert into project_participants (
         user_id, project_id, is_admin, approved, share_profile
       )
       select u.id, $1, true, true, true
       from users u
       where u.sub = 'e2e|admin'
       on conflict on constraint project_participants_pkey do update
       set is_admin = true, approved = true, share_profile = true`,
      [projectId]
    );

    const existing = await client.query(
      `select id from surveys where project_id = $1 and name = $2`,
      [projectId, SURVEY_NAME]
    );
    if (existing.rowCount !== 0) {
      throw new Error(`${SURVEY_NAME} already exists on ${SLUG}`);
    }

    const basemaps = await client.query(
      `select id, name from basemaps
       where project_id = $1 and name in ('Light', 'Satellite')
       order by id`,
      [projectId]
    );
    if (basemaps.rows.map((row) => row.name).join(",") !== "Light,Satellite") {
      throw new Error(
        `${SLUG} should have Light and Satellite basemaps, found ${basemaps.rows
          .map((row) => row.name)
          .join(", ")}`
      );
    }
    const basemapIds = basemaps.rows.map((row) => row.id);

    const jobsBefore = await client.query(
      `select count(*)::int as n from graphile_worker.jobs`
    );
    // snapshot-create starts from an empty queue. A developer database may
    // already have unrelated jobs; SEED_ALLOW_EXISTING_JOBS skips this guard
    // but still refuses below if seeding itself queues work onto that queue.
    if (
      process.env.SEED_ROLLBACK !== "1" &&
      process.env.SEED_ALLOW_EXISTING_JOBS !== "1" &&
      jobsBefore.rows[0].n !== 0
    ) {
      throw new Error(
        `Snapshot source already has ${jobsBefore.rows[0].n} graphile-worker job(s)`
      );
    }

    const created = await client.query(
      `select id from _create_survey($1, $2, null)`,
      [SURVEY_NAME, projectId]
    );
    const surveyId = created.rows[0].id;
    await client.query(
      `update surveys
       set is_disabled = false,
           access_type = 'PUBLIC',
           supported_languages = '{}',
           limit_to_single_response = false
       where id = $1`,
      [surveyId]
    );

    const form = await client.query(`select id from forms where survey_id = $1`, [
      surveyId,
    ]);
    const formId = form.rows[0].id;

    await client.query(
      `delete from form_elements fe
       using form_element_types t
       where fe.form_id = $1
         and t.component_name = fe.type_id
         and t.is_required_for_surveys = false`,
      [formId]
    );
    const remaining = await client.query(
      `select id, type_id from form_elements where form_id = $1 order by position, id`,
      [formId]
    );
    const remainingTypes = remaining.rows.map((row) => row.type_id).join(",");
    if (remainingTypes !== "WelcomeMessage,ThankYou,SaveScreen") {
      throw new Error(
        `Basic Template should leave Welcome, Thank You, and Save, found ${remainingTypes}`
      );
    }

    await client.query(
      `update form_elements
       set body = $2::jsonb, component_settings = $3::jsonb
       where id = $1`,
      [
        remaining.rows[0].id,
        jsonb(survey.welcome.body),
        jsonb(survey.welcome.componentSettings || {}),
      ]
    );

    const settings = {
      ...survey.spatial.componentSettings,
      basemaps: basemapIds,
    };
    const sectors = settings.sectorOptions || [];
    if (sectors.length !== 1 || sectors[0].value !== "coral") {
      throw new Error(
        `Palawan survey should collect one coral sector, found ${JSON.stringify(sectors)}`
      );
    }
    const sapId = await insertElement(client, formId, {
      ...survey.spatial,
      typeId: "SpatialAccessPriorityInput",
      componentSettings: settings,
      layout: "MAP_SIDEBAR_LEFT",
    });
    await client.query(
      `update form_elements set map_basemaps = $2 where id = $1`,
      [sapId, basemapIds]
    );

    const sketchForm = await client.query(
      `select f.id as form_id, sc.id as sketch_class_id
       from sketch_classes sc
       join forms f on f.sketch_class_id = sc.id
       where sc.form_element_id = $1`,
      [sapId]
    );
    if (sketchForm.rowCount !== 1) {
      throw new Error("Spatial question did not create a sketch-class form");
    }
    const sketchFormId = sketchForm.rows[0].form_id;
    await client.query(`delete from form_elements where form_id = $1`, [
      sketchFormId,
    ]);
    const byExportId = {};
    for (const element of survey.sketchElements) {
      byExportId[element.exportId] = await insertElement(
        client,
        sketchFormId,
        element
      );
    }

    for (const rule of survey.logicRules) {
      const targetId = byExportId[rule.targetExportId];
      const subjectId = byExportId[rule.subjectExportId];
      if (!targetId || !subjectId) {
        throw new Error(
          `Logic rule ${rule.subjectExportId} -> ${rule.targetExportId} is missing an element`
        );
      }
      const inserted = await client.query(
        `insert into form_logic_rules (
           form_element_id, boolean_operator, command, position
         ) values ($1, 'OR', 'SHOW', 0) returning id`,
        [targetId]
      );
      await client.query(
        `insert into form_logic_conditions (rule_id, subject_id, operator, value)
         values ($1, $2, $3, $4::jsonb)`,
        [
          inserted.rows[0].id,
          subjectId,
          sqlOperator(rule.operator),
          jsonb(rule.value),
        ]
      );
    }

    await client.query(
      `update sketch_classes set mapbox_gl_style = $2::jsonb where id = $1`,
      [sketchForm.rows[0].sketch_class_id, jsonb(survey.sketchStyle)]
    );

    const ordered = await client.query(
      `select id, type_id from form_elements where form_id = $1`,
      [formId]
    );
    const idFor = (typeId) => {
      const row = ordered.rows.find((element) => element.type_id === typeId);
      if (!row) {
        throw new Error(`Survey is missing ${typeId}`);
      }
      return row.id;
    };
    await client.query(
      `select set_form_element_order(array[$1, $2, $3, $4]::int[])`,
      [
        idFor("WelcomeMessage"),
        idFor("SpatialAccessPriorityInput"),
        idFor("SaveScreen"),
        idFor("ThankYou"),
      ]
    );

    const shapeOrder = await client.query(
      `select type_id from form_elements where form_id = $1 order by position`,
      [sketchFormId]
    );
    const shapeTypes = shapeOrder.rows.map((row) => row.type_id).join(",");
    if (
      shapeTypes !==
      "MultipleChoice,ShortText,Statement,MultipleChoice,ShortText,Statement,SAPRange,FeatureName"
    ) {
      throw new Error(`Unexpected shape questions: ${shapeTypes}`);
    }

    const jobsAfter = await client.query(
      `select count(*)::int as n from graphile_worker.jobs`
    );
    const jobsCreated = jobsAfter.rows[0].n - jobsBefore.rows[0].n;
    if (jobsCreated > 0) {
      if (jobsBefore.rows[0].n !== 0) {
        throw new Error(
          `Seeding queued ${jobsCreated} graphile-worker job(s) and the source was not empty`
        );
      }
      await client.query(`delete from graphile_worker.jobs`);
    }

    if (process.env.SEED_ROLLBACK === "1") {
      await client.query("ROLLBACK");
      console.log(`Rolled back ${SURVEY_NAME} on ${SLUG} after a successful dry run.`);
    } else {
      await client.query("COMMIT");
      console.log(`Seeded ${SURVEY_NAME} (${surveyId}) on ${SLUG}.`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
