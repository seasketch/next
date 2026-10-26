// Builds the Maldives Ocean Use Survey on demo-maldives.
//
// This is the Cypress surveyCreation before() hook: make a survey from the
// Basic Template, replace the three required pages, insert the rest of the
// questions, let the spatial question create its sketch-class form, then
// retarget jump rules and sector-attribute visibility onto the new ids.
// The form definition is snapshots/maldives-ocean-use, copied from the
// Cypress fixtures so the snapshot does not depend on those specs.
//
// The spatial question uses the project's Light and Satellite basemaps.
// Those are the two create_project adds. The Cypress survey created its own
// "Maldives Light" style; this seed does not.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SLUG = "demo-maldives";
const SURVEY_NAME = "Maldives Ocean Use Survey";
const FIXTURE = "Maldives";

function loadFixture(name) {
  const file = path.join(__dirname, "../snapshots/maldives-ocean-use", name);
  return JSON.parse(fs.readFileSync(file, "utf8"))[FIXTURE];
}

function elementText(body) {
  const node = body && body.content && body.content[0] && body.content[0].content && body.content[0].content[0];
  return node && typeof node.text === "string" ? node.text : "";
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
       background_color, secondary_color, text_variant, layout,
       alternate_language_settings
     ) values (
       $1, $2, $3, $4::jsonb, $5, $6::jsonb,
       $7, $8, $9, $10,
       $11::jsonb
     ) returning id`,
    [
      formId,
      !!element.isRequired,
      element.exportId || null,
      jsonb(element.componentSettings || {}),
      element.typeId,
      jsonb(element.body),
      element.backgroundColor || null,
      element.secondaryColor || null,
      element.textVariant || "DYNAMIC",
      element.layout || null,
      jsonb(element.alternateLanguageSettings || {}),
    ]
  );
  return result.rows[0].id;
}

async function updateRequiredElement(client, id, element) {
  await client.query(
    `update form_elements set
       body = $2::jsonb,
       position = $3,
       export_id = $4,
       component_settings = $5::jsonb,
       background_color = $6,
       secondary_color = $7,
       text_variant = $8,
       layout = $9,
       background_palette = $10,
       background_width = $11,
       background_height = $12,
       jump_to_id = $13,
       alternate_language_settings = $14::jsonb,
       subordinate_to = $15,
       background_image = $16,
       unsplash_author_name = $17,
       unsplash_author_url = $18
     where id = $1`,
    [
      id,
      jsonb(element.body),
      element.position,
      element.exportId || null,
      jsonb(element.componentSettings || {}),
      element.backgroundColor || null,
      element.secondaryColor || null,
      element.textVariant || "DYNAMIC",
      element.layout || null,
      element.backgroundPalette || null,
      element.backgroundWidth || null,
      element.backgroundHeight || null,
      element.jumpToId || null,
      jsonb(element.alternateLanguageSettings || {}),
      element.subordinateTo || null,
      element.backgroundImage || null,
      element.unsplashAuthorName || null,
      element.unsplashAuthorUrl || null,
    ]
  );
}

async function main() {
  const connectionString = process.env.SOURCE_URL;
  if (!connectionString) {
    console.error("SOURCE_URL is required.");
    process.exit(1);
  }

  const formElements = loadFixture("formElements.json").data.form.formElements;
  const sapElements = loadFixture("SAPElements.json").data.form.formElements;
  const logicRules = loadFixture("formLogicRules.json").data.form.logicRules;
  const sapSettings = JSON.parse(
    JSON.stringify(
      loadFixture("SAPComponentSettings.json").data.formElement.componentSettings
    )
  );

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

    const project = await client.query(
      `select id from projects where slug = $1`,
      [SLUG]
    );
    if (project.rowCount !== 1) {
      throw new Error(`${SLUG} is missing`);
    }
    const projectId = project.rows[0].id;

    // create_project already does this for e2e|admin. The upsert keeps a
    // dry run working against a project that someone else created.
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
    if (
      basemaps.rows.map((row) => row.name).join(",") !== "Light,Satellite"
    ) {
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
    if (process.env.SEED_ROLLBACK !== "1" && jobsBefore.rows[0].n !== 0) {
      throw new Error(
        `Snapshot source already has ${jobsBefore.rows[0].n} graphile-worker job(s)`
      );
    }

    // template_id null selects the Basic Template, the same default makeSurvey uses.
    const created = await client.query(
      `select id from _create_survey($1, $2, null)`,
      [SURVEY_NAME, projectId]
    );
    const surveyId = created.rows[0].id;
    // One response per person would block a developer replaying the survey,
    // and a second local run of the respondent journey.
    await client.query(
      `update surveys
       set is_disabled = false,
           access_type = 'PUBLIC',
           supported_languages = '{dv}',
           limit_to_single_response = false
       where id = $1`,
      [surveyId]
    );

    const form = await client.query(
      `select id from forms where survey_id = $1`,
      [surveyId]
    );
    const formId = form.rows[0].id;

    await client.query(
      `update form_elements set jump_to_id = null, subordinate_to = null where form_id = $1`,
      [formId]
    );
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

    // Same id assignment as updateFormElements. The fixture lists Save Screen
    // before Thank You, and the template lists Thank You before Save Screen,
    // so each fixture page lands on the row of the same type. Save Screen's
    // position (33) then sorts ahead of Thank You (34), and both sort ahead
    // of the questions inserted below.
    const requiredFixtures = formElements.filter((element) =>
      ["WelcomeMessage", "SaveScreen", "ThankYou"].includes(element.typeId)
    );
    if (requiredFixtures.map((element) => element.typeId).join(",") !== "WelcomeMessage,SaveScreen,ThankYou") {
      throw new Error("Survey fixture required pages are not Welcome, Save Screen, Thank You");
    }
    const requiredIds = [
      remaining.rows[0].id,
      remaining.rows[2].id,
      remaining.rows[1].id,
    ];
    for (let i = 0; i < requiredFixtures.length; i++) {
      await updateRequiredElement(client, requiredIds[i], requiredFixtures[i]);
    }

    for (const element of formElements) {
      if (["WelcomeMessage", "ThankYou", "SaveScreen"].includes(element.typeId)) {
        continue;
      }
      await insertElement(client, formId, element);
    }

    const ordered = await client.query(
      `select id, type_id, body, export_id from form_elements
       where form_id = $1 order by position, id`,
      [formId]
    );
    const elements = ordered.rows;
    if (elements.length !== formElements.length) {
      throw new Error(
        `Survey form has ${elements.length} elements, fixture has ${formElements.length}`
      );
    }

    const jumpTargets = elements.filter(
      (element) =>
        element.type_id === "SpatialAccessPriorityInput" ||
        element.type_id === "SaveScreen"
    );
    if (jumpTargets.length !== 2) {
      throw new Error(
        `Expected Save Screen and the spatial question, found ${jumpTargets
          .map((element) => element.type_id)
          .join(", ")}`
      );
    }
    // Position order is Save Screen, then the spatial question.
    const saveScreenId = jumpTargets[0].id;
    const sapId = jumpTargets[1].id;
    if (jumpTargets[0].type_id !== "SaveScreen" || jumpTargets[1].type_id !== "SpatialAccessPriorityInput") {
      throw new Error(
        `Jump targets are ${jumpTargets[0].type_id} then ${jumpTargets[1].type_id}`
      );
    }

    const elementsToJump = elements.slice(5, 24);
    if (!elements[30]) {
      throw new Error("Survey form has no element at position index 30");
    }
    elementsToJump.push(elements[30]);
    for (const element of elementsToJump) {
      const jumpToId = element.type_id === "YesNo" ? saveScreenId : sapId;
      await client.query(`update form_elements set jump_to_id = $2 where id = $1`, [
        element.id,
        jumpToId,
      ]);
    }

    const subordinateTexts = [
      "If you are representing a guesthouse, please provide the name of your establishment:",
      "Please indicate how many people are reflected in this response",
      "Are you a part-time or full-time fisher?",
      "Please provide the name or the number of the vessel you fish on",
    ];
    const subordinates = elements.filter((element) =>
      subordinateTexts.includes(elementText(element.body))
    );
    if (subordinates.length !== subordinateTexts.length) {
      throw new Error(
        `Expected ${subordinateTexts.length} subordinate questions, found ${subordinates.length}`
      );
    }
    for (const element of subordinates) {
      await client.query(
        `update form_elements set subordinate_to = $2 where id = $1`,
        [element.id, sapId]
      );
    }

    const sketchForm = await client.query(
      `select f.id
       from sketch_classes sc
       join forms f on f.sketch_class_id = sc.id
       where sc.form_element_id = $1`,
      [sapId]
    );
    if (sketchForm.rowCount !== 1) {
      throw new Error("Spatial question did not create a sketch-class form");
    }
    const sketchFormId = sketchForm.rows[0].id;
    for (const element of sapElements) {
      if (element.typeId === "FeatureName" || element.typeId === "SAPRange") {
        continue;
      }
      await insertElement(client, sketchFormId, element);
    }

    // Cypress getIds: the atoll question id, then the next 19 ids. Those are
    // the island questions because they are inserted before the spatial
    // question, whose trigger consumes the following two ids.
    const atoll = elements.find(
      (element) =>
        element.type_id === "MultipleChoice" &&
        elementText(element.body) === "Which Atoll do you reside on?"
    );
    if (!atoll) {
      throw new Error("Atoll question is missing");
    }
    const newIds = [];
    let baseId = atoll.id;
    for (let i = 0; i < 20; i++) {
      newIds.push(baseId);
      baseId += 1;
    }
    newIds.push(newIds[19] + 8);
    newIds.push(newIds[20] + 1);

    const rules = JSON.parse(JSON.stringify(logicRules));
    for (let i = 0; i < rules.length; i++) {
      rules[i].jumpToId = newIds[i + 1];
    }
    for (const rule of rules) {
      const subjectId = rule.conditions[0].subjectId;
      if (rule.formElementId === 74 && subjectId === 74) {
        rule.formElementId = newIds[0];
        rule.conditions[0].subjectId = newIds[0];
      } else if (rule.formElementId === 98 && subjectId === 98) {
        rule.formElementId = newIds[20];
        rule.conditions[0].subjectId = newIds[20];
        rule.jumpToId = newIds[21];
      } else if (rule.formElementId === 99 && subjectId === 99) {
        rule.formElementId = newIds[21];
        rule.conditions[0].subjectId = newIds[21];
        rule.jumpToId = newIds[21] + 1;
      }
    }
    for (const rule of rules) {
      const inserted = await client.query(
        `insert into form_logic_rules (
           form_element_id, boolean_operator, command, jump_to_id, position
         ) values ($1, $2, $3, $4, $5) returning id`,
        [
          rule.formElementId,
          rule.booleanOperator,
          rule.command,
          rule.jumpToId,
          rule.position,
        ]
      );
      const condition = rule.conditions[0];
      await client.query(
        `insert into form_logic_conditions (rule_id, subject_id, operator, value)
         values ($1, $2, $3, $4::jsonb)`,
        [
          inserted.rows[0].id,
          condition.subjectId,
          sqlOperator(condition.operator),
          jsonb(condition.value),
        ]
      );
    }

    const sketchElements = await client.query(
      `select id, export_id from form_elements where form_id = $1`,
      [sketchFormId]
    );
    const referenceElements = {};
    const exportIds = {
      tuna_gear: 0,
      tuna_species: 1,
      gear_ntuna: 2,
      nontuna_species: 3,
      recfish_type: 4,
      num_of_ppl: 5,
      "part-time": 6,
      vessel: 7,
      guesthouse_name: 8,
      nontuna_sp: 9,
    };
    for (const element of [...elements, ...sketchElements.rows]) {
      const exportId = element.export_id;
      // tuna_gear is 0, which the Cypress check treats as missing, then adds
      // in the next branch. part_time in the visibility settings does not
      // match the export id part-time, so that question is left out.
      if (exportIds[exportId] && exportId !== "tuna_gear") {
        referenceElements[exportId] = element.id;
      } else if (exportId === "tuna_gear") {
        referenceElements.tuna_gear = element.id;
      }
    }

    function remap(settings) {
      const remapped = {};
      for (const key of Object.keys(settings)) {
        if (referenceElements[key]) {
          remapped[referenceElements[key]] = settings[key];
        }
      }
      return remapped;
    }
    sapSettings.childVisibilitySettings = remap(sapSettings.childVisibilitySettings);
    sapSettings.subordinateVisibilitySettings = remap(
      sapSettings.subordinateVisibilitySettings
    );
    sapSettings.basemaps = basemapIds;
    await client.query(
      `update form_elements
       set component_settings = $2::jsonb, map_basemaps = $3
       where id = $1`,
      [sapId, jsonb(sapSettings), basemapIds]
    );

    const nJump = await client.query(
      `select target.body as body
       from form_logic_rules r
       join form_logic_conditions c on c.rule_id = r.id
       join form_elements target on target.id = r.jump_to_id
       where c.subject_id = $1 and c.value = '"N"'::jsonb`,
      [atoll.id]
    );
    const nText = nJump.rows.map((row) => elementText(row.body)).join(" | ");
    if (!nText.includes("island of N atoll")) {
      throw new Error(`Atoll N should jump to the N island question, found "${nText}"`);
    }

    const yesJump = await client.query(
      `select elementText.body as body
       from form_logic_conditions c
       join form_logic_rules r on r.id = c.rule_id
       join form_elements elementText on elementText.id = r.jump_to_id
       where c.value = 'true'::jsonb
         and c.subject_id in (select id from form_elements where form_id = $1)`,
      [formId]
    );
    const yesText = yesJump.rows.map((row) => elementText(row.body)).join(" | ");
    if (yesText !== "Your age") {
      throw new Error(`Yes should jump to Your age, found "${yesText}"`);
    }

    const tuna = Object.values(sapSettings.childVisibilitySettings)[0];
    if (
      !tuna ||
      tuna.enabled !== true ||
      (tuna.sectors || []).join(",") !== "Fisheries - Commercial, Tuna"
    ) {
      throw new Error(
        `Tuna gear should be visible for the tuna sector, found ${JSON.stringify(tuna)}`
      );
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
      const queued = await client.query(
        `select task_identifier, count(*)::int as n from graphile_worker.jobs group by 1`
      );
      console.log(
        `Removing jobs queued while seeding the survey: ${queued.rows
          .map((row) => `${row.task_identifier} (${row.n})`)
          .join(", ")}`
      );
      await client.query(`delete from graphile_worker.jobs`);
    }

    if (process.env.SEED_ROLLBACK === "1") {
      await client.query("ROLLBACK");
      console.log(
        `Rolled back ${SURVEY_NAME} on ${SLUG} after a successful dry run.`
      );
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
