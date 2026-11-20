import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { Client } from "pg";
import { createShellProject } from "../src/shellProject";
import { clientURL, databaseURL, personas } from "../src/config";
import { hardDeleteProject } from "../src/db";
import { signIn } from "../src/project";

/**
 * A short survey in the shape of the Maldives Ocean Use Survey: a welcome
 * that promises confidentiality, consent, name and email, one region
 * question with a follow-up for each answer, a yes/no, and a spatial
 * question with two sectors. The ocean-use fixture repeats that region
 * pattern once per atoll. This journey keeps one pair.
 *
 * Creating a survey copies the Basic Template: welcome, informed consent,
 * one blank short-text question, save screen, and thank you. The journey
 * writes the confidentiality line on the welcome, sets the consent agree
 * label, and removes the blank question before adding the ocean-use steps.
 *
 * The consent upload mutation stores the PDF on the public S3 bucket.
 * After the agree label is set, the journey calls create_consent_document
 * so the agreement has a URL without that upload.
 *
 * The reef journey has no spatial step, so it can reload the logic editor.
 * It covers the rule operators beyond equality: contains on a multi-select,
 * blank on a text area, a two-condition numeric range, and yes/no. It also
 * sets default jumps on an input and on a statement, and a jump to the save
 * screen. Its visitors go back and change answers so each branch is taken
 * again from the same response.
 */

const surveyName = "Coastal Use Survey";
const confidential = "Your individual responses will be kept confidential.";
const regionQuestion = "Which region do you fish in?";
const northQuestion = "Which island of the north?";
const southQuestion = "Which island of the south?";
const fishQuestion = "Do you fish commercially?";
const sectorQuestion = "What sectors do you represent?";
const agreeLabel = "I agree to share my answers";
const northIsland = "Kudafari";
const respondent = "E2E Survey Builder";
const email = "e2e-survey-builder@example.test";

const reefSurveyName = "Reef Activities Survey";
const activitiesQuestion = "Which reef activities do you take part in?";
const snorkelLabel = "Snorkeling, freediving";
const sitesQuestion = "Which snorkel sites do you visit?";
const daysQuestion = "How many days a year do you fish?";
const statementHeading = "Almost done";
const interviewQuestion = "Would you join a follow-up interview?";
const phoneQuestion = "What phone number can we call?";

const created: string[] = [];
let slugSerial = 0;

test.afterEach(async () => {
  for (const slug of created.splice(0)) {
    await hardDeleteProject(slug);
  }
});

function projectSlug(label: string) {
  slugSerial += 1;
  return `e2e-${label}-${slugSerial}${Date.now().toString(36)}`.slice(0, 24);
}

function waitForOperation(page: Page, operation: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/graphql") &&
      (response.request().postData() || "").includes(
        `"operationName":"${operation}"`
      )
  );
}

function formList(page: Page) {
  return page.locator("nav").filter({ hasText: "Form Elements" });
}

function logicPanel(page: Page) {
  return page.locator("div.bg-white.w-72");
}

async function addElement(page: Page, label: string) {
  const added = waitForOperation(page, "AddFormElement");
  await page
    .getByRole("button", { name: "Add", exact: true })
    .and(page.locator("button:not([title])"))
    .click();
  const menu = page.locator(".max-h-128");
  await expect(menu.getByRole("heading", { name: "Add to survey..." })).toBeVisible();
  await menu
    .locator("div.text-base")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click();
  await added;
}

function settingSwitch(page: Page, title: string) {
  return page
    .locator("div.w-64 div.flex")
    .filter({ hasText: new RegExp(`^\\s*${title}\\s*$`) })
    .getByRole("switch");
}

async function toggleSetting(page: Page, title: string) {
  const toggle = settingSwitch(page, title);
  const saved = waitForOperation(page, "UpdateFormElement");
  await toggle.click();
  await saved;
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

async function removeStarterQuestion(page: Page) {
  await deleteElement(page, /^\s*T\s*$/);
}

async function deleteElement(page: Page, text: RegExp) {
  const row = formList(page).locator(".h-11").filter({ hasText: text });
  await expect(row).toHaveCount(1);
  await row.click();
  await page.getByRole("button", { name: "Delete Element" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Are you sure you want to delete this element?",
  });
  const deleted = waitForOperation(page, "DeleteFormElement");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await deleted;
  await expect(row).toHaveCount(0);
}

async function addRule(page: Page, name: "Add conditions" | "Add another rule") {
  const created = waitForOperation(page, "createLogicRuleForSurvey");
  await logicPanel(page).getByRole("button", { name }).click();
  await created;
}

async function replaceQuestion(page: Page, text: string) {
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  const saved = waitForOperation(page, "UpdateFormElementBody");
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(text);
  await saved;
  await expect(editor).toContainText(text);
}

async function fillLabeledInput(page: Page, label: string, value: string) {
  const input = page
    .locator("label", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::div//input");
  const saved = waitForOperation(page, "UpdateFormElement");
  await input.fill(value);
  await saved;
  await expect(input).toHaveValue(value);
}

async function fillOptions(page: Page, heading: string, text: string) {
  const block = page.locator("div.relative").filter({
    has: page.getByRole("heading", { name: heading, exact: true }),
  });
  const area = block.locator("textarea");
  const saved = waitForOperation(page, "UpdateFormElement");
  await area.fill(text);
  await saved;
  await expect(area).toHaveValue(text);
}

function ruleCard(page: Page, index: number): Locator {
  return logicPanel(page).locator("div.border.bg-gray-50").nth(index);
}

async function chooseOption(select: Locator, label: RegExp | string) {
  const saved = waitForOperation(select.page(), "UpdateLogicCondition");
  await select.selectOption({ label });
  await saved;
}

async function chooseJump(select: Locator, label: string, operation: string) {
  const chosen = await select.evaluate((element, wanted) => {
    const field = element as HTMLSelectElement;
    const current = field.selectedOptions[0]?.text.trim();
    if (current === wanted) {
      return null;
    }
    const match = Array.from(field.options).find(
      (option) => option.text.trim() === wanted && !option.disabled
    );
    return match?.value ?? "";
  }, label);
  if (chosen === null) {
    return;
  }
  if (!chosen) {
    throw new Error(`No enabled option for ${label}`);
  }
  const saved = waitForOperation(select.page(), operation);
  await select.selectOption(chosen);
  await saved;
}

async function attachConsentDocument(slug: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const admin = await client.query(`select id from users where sub = 'e2e|admin'`);
    const userId = admin.rows[0]?.id;
    if (typeof userId !== "number") {
      throw new Error("e2e|admin is missing");
    }
    await client.query(`select set_config('session.user_id', $1, false)`, [
      String(userId),
    ]);
    const element = await client.query(
      `select fe.id
       from form_elements fe
       join forms f on f.id = fe.form_id
       join surveys s on s.id = f.survey_id
       join projects p on p.id = s.project_id
       where p.slug = $1 and s.name = $2 and fe.type_id = 'Consent'`,
      [slug, surveyName]
    );
    if (element.rowCount !== 1) {
      throw new Error(`Consent step is missing on ${slug}`);
    }
    await client.query(`select create_consent_document($1, 1, $2)`, [
      element.rows[0].id,
      `${clientURL}/`,
    ]);
  } finally {
    await client.end();
  }
}

async function createSurvey(
  page: Page,
  request: APIRequestContext,
  slug: string,
  projectName: string,
  name: string
) {
  await createShellProject(request, { name: projectName, slug });
  await signIn(page, request, personas.admin);
  await page.goto(`/${slug}/admin/surveys`);
  await page.getByRole("button", { name: "Create a New Survey" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a name for your survey" });
  await dialog.getByRole("textbox").fill(name);
  const createdSurvey = waitForOperation(page, "CreateSurvey");
  await dialog.getByRole("button", { name: "Submit" }).click();
  await createdSurvey;
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("link", { name: "Edit Form" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/survey-editor/\\d+`));
  await expect(
    page.getByRole("heading", { name: "Welcome to the Survey", exact: true })
  ).toBeVisible();
}

/**
 * Leaving the editor for a blank page first keeps two copies of it out of
 * memory at once. A direct reload of the editor has crashed Chrome locally.
 */
async function leaveEditorFor(page: Page, url: string) {
  await page.goto("about:blank");
  await page.goto(url);
}

async function publishSurvey(page: Page, slug: string, name: string) {
  await leaveEditorFor(page, `/${slug}/admin/surveys`);
  await page.getByRole("link", { name }).click();
  const published = waitForOperation(page, "UpdateSurveyDraftStatus");
  await page.getByText("Published", { exact: true }).click();
  await published;
  const publicLink = page.getByRole("link", {
    name: new RegExp(`/${slug}/surveys/\\d+`),
  });
  await expect(publicLink).toBeVisible();
  const surveyUrl = await publicLink.getAttribute("href");
  if (!surveyUrl) {
    throw new Error("Published survey has no public link");
  }
  return surveyUrl;
}

async function selectNode(page: Page, text: string) {
  await page.locator(".react-flow__node").filter({ hasText: text }).click();
}

function conditionRow(rule: Locator, index: number) {
  return rule.locator("div.bg-blue-100").nth(index);
}

async function chooseOperator(row: Locator, label: RegExp) {
  const page = row.page();
  await row.getByRole("button", { name: "Comparison" }).click();
  const saved = waitForOperation(page, "UpdateLogicCondition");
  await page.getByRole("menuitemradio", { name: label }).click();
  await saved;
}

async function fillConditionNumber(row: Locator, value: string) {
  const input = row.getByRole("spinbutton");
  const saved = waitForOperation(row.page(), "UpdateLogicCondition");
  await input.fill(value);
  await saved;
  await expect(input).toHaveValue(value);
}

async function addCondition(rule: Locator) {
  const added = waitForOperation(rule.page(), "AddCondition");
  await rule.getByRole("button", { name: "add condition" }).click();
  await added;
}

async function openSurvey(browser: Browser, url: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await page.locator('[name="Begin Survey"]').click();
  return { context, page };
}

async function goBack(page: Page, question: string) {
  await page.getByTitle("Previous Question").click();
  await expect(page.getByText(question)).toBeVisible();
}

async function answerText(page: Page, value: string) {
  const field = page.locator("input:visible").last();
  await field.click();
  await field.fill(value);
  await expect(field).toHaveValue(value);
  await field.press("Enter");
}

test.describe("survey authoring @admin @surveys", () => {
  test.use({ viewport: { width: 1440, height: 900 }, actionTimeout: 20_000 });

  test("an admin builds a coastal-use survey and a visitor follows its region skip", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(300_000);
    const slug = projectSlug("srv");
    created.push(slug);
    await createSurvey(page, request, slug, "Coastal Use Builder", surveyName);
    await expect(
      page.getByText("Please describe your survey to potential respondents here.")
    ).toBeVisible();

    const editor = page.locator(".ProseMirror").first();
    const welcomeSaved = waitForOperation(page, "UpdateFormElementBody");
    await editor
      .getByText("Please describe your survey to potential respondents here.")
      .click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(` ${confidential}`);
    await welcomeSaved;
    await expect(editor).toContainText(confidential);

    await formList(page).getByText("Informed Consent").click();
    await expect(page.getByText("Informed Consent").first()).toBeVisible();
    await fillLabeledInput(page, "Agree button label", agreeLabel);
    await removeStarterQuestion(page);

    await addElement(page, "Name");
    await expect(page.getByText("What is your name?").first()).toBeVisible();
    await toggleSetting(page, "Required");

    await addElement(page, "Email");
    await expect(page.getByText("What is your email address?").first()).toBeVisible();

    await addElement(page, "Multiple Choice");
    await replaceQuestion(page, regionQuestion);
    await fillOptions(page, "Options", "North,N\nSouth,S");
    await expect(page.getByTitle("North", { exact: true })).toBeVisible();
    await expect(page.getByTitle("South", { exact: true })).toBeVisible();

    await addElement(page, "Short Text");
    await replaceQuestion(page, northQuestion);
    await addElement(page, "Short Text");
    await replaceQuestion(page, southQuestion);

    await addElement(page, "Yes/No");
    await replaceQuestion(page, fishQuestion);

    await addElement(page, "Spatial Access Priority");
    await expect(page.getByText(sectorQuestion).first()).toBeVisible();
    await fillOptions(
      page,
      "Sector Options",
      "Commercial Fishing,fishing_com\nDiving,diving"
    );

    const sidebar = formList(page);
    await expect(sidebar.getByText("Informed Consent")).toBeVisible();
    await expect(sidebar.getByText("What is your name?")).toBeVisible();
    await expect(sidebar.getByText("What is your email address?")).toBeVisible();
    await expect(sidebar.getByText(regionQuestion)).toBeVisible();
    await expect(sidebar.getByText(northQuestion)).toBeVisible();
    await expect(sidebar.getByText(southQuestion)).toBeVisible();
    await expect(sidebar.getByText(fishQuestion)).toBeVisible();
    await expect(sidebar.getByText(sectorQuestion)).toBeVisible();

    await page.getByRole("link", { name: "Skip Logic", exact: true }).click();
    await expect(page).toHaveURL(/\/logic$/);
    await expect(
      page.getByText("Select an input element to skip ahead based on answers.")
    ).toBeVisible();

    await page
      .locator(".react-flow__node")
      .filter({ hasText: regionQuestion })
      .click();
    await addRule(page, "Add conditions");
    await expect(logicPanel(page).getByText("Skip to").first()).toBeVisible();
    const northRule = ruleCard(page, 0);
    await chooseOption(northRule.getByRole("combobox").nth(1), "North");
    await chooseJump(
      northRule.getByRole("combobox").nth(0),
      northQuestion,
      "UpdateFormLogicRule"
    );

    await addRule(page, "Add another rule");
    const southRule = ruleCard(page, 1);
    await chooseOption(southRule.getByRole("combobox").nth(1), "South");
    await chooseJump(
      southRule.getByRole("combobox").nth(0),
      southQuestion,
      "UpdateFormLogicRule"
    );

    await page
      .locator(".react-flow__node")
      .filter({ hasText: northQuestion })
      .click();
    await expect(
      logicPanel(page).getByText("Survey advances from this question to...")
    ).toBeVisible();
    await chooseJump(
      logicPanel(page).getByRole("combobox"),
      fishQuestion,
      "UpdateFormElement"
    );

    await attachConsentDocument(slug);
    await leaveEditorFor(
      page,
      `/${slug}/survey-editor/${page.url().match(/survey-editor\/(\d+)/)?.[1]}`
    );
    await sidebar.getByText("Informed Consent").click();
    await expect(page.getByRole("link", { name: /Data Sharing Agreement/ })).toBeVisible();
    await expect(page.getByText(agreeLabel).first()).toBeVisible();

    const surveyUrl = await publishSurvey(page, slug, surveyName);

    const guestContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const guest = await guestContext.newPage();
    try {
      await guest.emulateMedia({ reducedMotion: "reduce" });
      await guest.goto(surveyUrl);
      await expect(guest.locator('[name="Begin Survey"]')).toBeVisible({ timeout: 20_000 });
      await expect(guest.getByRole("heading", { name: "Welcome to the Survey" })).toBeVisible();
      await expect(guest.getByText(confidential)).toBeVisible();
      await guest.locator('[name="Begin Survey"]').click();

      await expect(guest.getByText("Informed Consent")).toBeVisible();
      await expect(guest.getByRole("link", { name: /Data Sharing Agreement/ })).toHaveAttribute(
        "href",
        `${clientURL}/`
      );
      await guest.getByRole("button", { name: agreeLabel }).click();

      await expect(guest.getByText("What is your name?")).toBeVisible();
      await expect(guest.getByTitle("Next Question")).toHaveClass(/pointer-events-none/);
      await answerText(guest, respondent);

      await expect(guest.getByText("What is your email address?")).toBeVisible();
      await answerText(guest, email);

      await expect(guest.getByText(regionQuestion)).toBeVisible();
      await guest.getByTitle("North", { exact: true }).click();
      await expect(guest.getByText(northQuestion)).toBeVisible();
      await expect(guest.getByText(southQuestion)).toHaveCount(0);
      await answerText(guest, northIsland);

      await expect(guest.getByText(fishQuestion)).toBeVisible();
      await expect(guest.getByText(southQuestion)).toHaveCount(0);
      await guest.getByTitle("Yes", { exact: true }).click();

      await expect(guest.getByText(sectorQuestion)).toBeVisible();
      await expect(guest.getByTitle("Commercial Fishing", { exact: true })).toBeVisible();
      await expect(guest.getByTitle("Diving", { exact: true })).toBeVisible();
      await expect(guest.getByTitle("Recreational Fishing")).toHaveCount(0);
      const sectorNext = guest.getByRole("button", { name: "Next", exact: true });
      await expect(sectorNext).toBeDisabled();
      await guest.getByTitle("Commercial Fishing", { exact: true }).click();
      await expect(sectorNext).toBeEnabled();
    } finally {
      await guestContext.close();
    }

    const southContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const southGuest = await southContext.newPage();
    try {
      await southGuest.emulateMedia({ reducedMotion: "reduce" });
      await southGuest.goto(surveyUrl);
      await expect(southGuest.locator('[name="Begin Survey"]')).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        southGuest.getByRole("heading", { name: "Welcome to the Survey" })
      ).toBeVisible();
      await southGuest.locator('[name="Begin Survey"]').click();
      await southGuest.getByRole("button", { name: agreeLabel }).click();
      await answerText(southGuest, respondent);
      await answerText(southGuest, email);
      await southGuest.getByTitle("South", { exact: true }).click();
      await expect(southGuest.getByText(southQuestion)).toBeVisible();
      await expect(southGuest.getByText(northQuestion)).toHaveCount(0);
    } finally {
      await southContext.close();
    }
  });

  test("an admin branches a reef survey on choice, text, number, and yes/no answers", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(300_000);
    const slug = projectSlug("srl");
    created.push(slug);
    await createSurvey(page, request, slug, "Reef Logic Builder", reefSurveyName);
    await removeStarterQuestion(page);
    await deleteElement(page, /Informed Consent/);

    await addElement(page, "Multiple Choice");
    await replaceQuestion(page, activitiesQuestion);
    await toggleSetting(page, "Multiple Select");
    await expect(
      page.getByRole("button", { name: "Edit Visibility Logic" })
    ).toHaveCount(0);
    const quotedOption = `"${snorkelLabel}",snorkel`;
    await fillOptions(page, "Options", `${quotedOption}\nFishing,fishing`);
    await expect(page.getByTitle(snorkelLabel, { exact: true })).toBeVisible();

    // Reopening the question re-serializes its options (#972).
    const sidebar = formList(page);
    await sidebar.getByText("Welcome to the Survey").click();
    await sidebar.getByText(activitiesQuestion).click();
    const options = page
      .locator("div.relative")
      .filter({ has: page.getByRole("heading", { name: "Options", exact: true }) })
      .locator("textarea");
    await expect(options).toHaveValue(`${quotedOption}\nFishing,fishing`);
    await options.click();
    await options.press("Control+End");
    const extended = waitForOperation(page, "UpdateFormElement");
    await options.press("Enter");
    await page.keyboard.insertText("Research,research");
    await extended;
    await expect(options).toHaveValue(
      `${quotedOption}\nFishing,fishing\nResearch,research`
    );
    await expect(page.getByTitle(snorkelLabel, { exact: true })).toBeVisible();
    await expect(page.getByTitle("Research", { exact: true })).toBeVisible();

    await addElement(page, "Text Area");
    await replaceQuestion(page, sitesQuestion);
    await addElement(page, "Number");
    await replaceQuestion(page, daysQuestion);

    await addElement(page, "Statement");
    const statement = page.locator(".ProseMirror").first();
    await statement.getByText("Heading", { exact: true }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    const headingSaved = waitForOperation(page, "UpdateFormElementBody");
    await page.keyboard.insertText(statementHeading);
    await headingSaved;
    await expect(statement.getByRole("heading", { name: statementHeading })).toBeVisible();

    await addElement(page, "Yes/No");
    await replaceQuestion(page, interviewQuestion);
    await addElement(page, "Short Text");
    await replaceQuestion(page, phoneQuestion);

    await page.getByRole("link", { name: "Skip Logic", exact: true }).click();
    await expect(page).toHaveURL(/\/logic$/);

    await selectNode(page, activitiesQuestion);
    await addRule(page, "Add conditions");
    const fishingRule = ruleCard(page, 0);
    await chooseOperator(conditionRow(fishingRule, 0), /^Contains/);
    await chooseOption(fishingRule.getByRole("combobox").nth(1), "Fishing");
    await chooseJump(fishingRule.getByRole("combobox").nth(0), daysQuestion, "UpdateFormLogicRule");

    await selectNode(page, sitesQuestion);
    await addRule(page, "Add conditions");
    const blankRule = ruleCard(page, 0);
    await expect(
      conditionRow(blankRule, 0).getByRole("button", { name: "Comparison" })
    ).toHaveText("Blank");
    await chooseJump(blankRule.getByRole("combobox").nth(0), interviewQuestion, "UpdateFormLogicRule");
    await chooseJump(
      logicPanel(page).getByRole("combobox").last(),
      statementHeading,
      "UpdateFormElement"
    );

    await selectNode(page, daysQuestion);
    await addRule(page, "Add conditions");
    const rangeRule = ruleCard(page, 0);
    await chooseOperator(conditionRow(rangeRule, 0), /^>$/);
    await fillConditionNumber(conditionRow(rangeRule, 0), "100");
    await addCondition(rangeRule);
    await chooseOperator(conditionRow(rangeRule, 1), /^<$/);
    await fillConditionNumber(conditionRow(rangeRule, 1), "5");
    await addCondition(rangeRule);
    await expect(rangeRule.locator("div.bg-blue-100")).toHaveCount(3);
    page.once("dialog", (dialog) => dialog.accept());
    const conditionDeleted = waitForOperation(page, "DeleteLogicCondition");
    await conditionRow(rangeRule, 2).locator("button").last().click();
    await conditionDeleted;
    await expect(rangeRule.locator("div.bg-blue-100")).toHaveCount(2);
    await chooseJump(rangeRule.getByRole("combobox").nth(0), interviewQuestion, "UpdateFormLogicRule");

    await addRule(page, "Add another rule");
    await expect(logicPanel(page).locator("div.border.bg-gray-50")).toHaveCount(2);
    await ruleCard(page, 1).locator("h4 button").click();
    const ruleDialog = page.getByRole("dialog", {
      name: "Are you sure you want to delete this rule?",
    });
    const ruleDeleted = waitForOperation(page, "DeleteLogicRule");
    await ruleDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await ruleDeleted;
    await expect(logicPanel(page).locator("div.border.bg-gray-50")).toHaveCount(1);

    await selectNode(page, statementHeading);
    await expect(
      logicPanel(page).getByText("Survey advances from this question to...")
    ).toBeVisible();
    await chooseJump(logicPanel(page).getByRole("combobox"), phoneQuestion, "UpdateFormElement");

    await selectNode(page, interviewQuestion);
    await addRule(page, "Add conditions");
    const declineRule = ruleCard(page, 0);
    // A new yes/no condition has no answer until the admin picks one (#726, #756).
    const declineValue = declineRule.getByRole("combobox").nth(1);
    await expect(declineValue).toHaveValue("NULL");
    await chooseOption(declineValue, "No");
    await chooseJump(declineRule.getByRole("combobox").nth(0), "Save Screen", "UpdateFormLogicRule");

    await leaveEditorFor(page, page.url());
    await selectNode(page, daysQuestion);
    const savedRange = ruleCard(page, 0);
    await expect(savedRange.getByRole("button", { name: "Comparison" })).toHaveText([">", "<"]);
    await expect(conditionRow(savedRange, 0).getByRole("spinbutton")).toHaveValue("100");
    await expect(conditionRow(savedRange, 1).getByRole("spinbutton")).toHaveValue("5");
    await selectNode(page, interviewQuestion);
    await expect(ruleCard(page, 0).getByRole("combobox").nth(1)).toHaveValue("FALSE");

    const surveyUrl = await publishSurvey(page, slug, reefSurveyName);

    const snorkeler = await openSurvey(browser, surveyUrl);
    try {
      const visitor = snorkeler.page;
      await expect(visitor.getByText(activitiesQuestion)).toBeVisible();
      await visitor.getByTitle(snorkelLabel, { exact: true }).click();
      await visitor.getByTitle("Research", { exact: true }).click();
      await visitor.getByRole("button", { name: "Next", exact: true }).click();

      await expect(visitor.getByText(sitesQuestion)).toBeVisible();
      const sites = visitor.locator("textarea:visible");
      await sites.fill("Coral Garden");
      await visitor.getByRole("button", { name: "Next", exact: true }).click();
      await expect(visitor.getByRole("heading", { name: statementHeading })).toBeVisible();
      await expect(visitor.getByText(daysQuestion)).toHaveCount(0);
      await visitor.getByRole("button", { name: "Next", exact: true }).click();
      await expect(visitor.getByText(phoneQuestion)).toBeVisible();
      await expect(visitor.getByText(interviewQuestion)).toHaveCount(0);

      await goBack(visitor, statementHeading);
      await goBack(visitor, sitesQuestion);
      await visitor.locator("textarea:visible").fill("");
      await visitor.getByRole("button", { name: "Skip Question", exact: true }).click();
      await expect(visitor.getByText(interviewQuestion)).toBeVisible();
      await visitor.getByTitle("No", { exact: true }).click();
      await expect(
        visitor.getByRole("heading", { name: "Thank You for Responding" })
      ).toBeVisible();
      await expect(visitor.getByText(phoneQuestion)).toHaveCount(0);
    } finally {
      await snorkeler.context.close();
    }

    const fisher = await openSurvey(browser, surveyUrl);
    try {
      const visitor = fisher.page;
      await visitor.getByTitle("Fishing", { exact: true }).click();
      await visitor.getByRole("button", { name: "Next", exact: true }).click();
      await expect(visitor.getByText(daysQuestion)).toBeVisible();
      await expect(visitor.getByText(sitesQuestion)).toHaveCount(0);

      await answerText(visitor, "150");
      await expect(visitor.getByText(interviewQuestion)).toBeVisible();
      await visitor.getByTitle("Yes", { exact: true }).click();
      await expect(visitor.getByText(phoneQuestion)).toBeVisible();

      await goBack(visitor, interviewQuestion);
      await goBack(visitor, daysQuestion);
      await answerText(visitor, "2");
      await expect(visitor.getByText(interviewQuestion)).toBeVisible();

      await goBack(visitor, daysQuestion);
      await answerText(visitor, "50");
      await expect(visitor.getByRole("heading", { name: statementHeading })).toBeVisible();
      await visitor.getByRole("button", { name: "Next", exact: true }).click();
      await expect(visitor.getByText(phoneQuestion)).toBeVisible();
      await expect(visitor.getByText(interviewQuestion)).toHaveCount(0);
    } finally {
      await fisher.context.close();
    }
  });
});
