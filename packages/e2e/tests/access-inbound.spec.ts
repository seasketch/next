import crypto from "crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import {
  accessRequestIds,
  approveMember,
  createAccessProject,
  currentUserId,
  denyMember,
  inviteMember,
} from "../src/accessProject";
import { issueToken } from "../src/auth";
import { personas } from "../src/config";
import {
  createE2EUser,
  deleteE2EUser,
  disposableUser,
  hardDeleteProject,
  participantCount,
  projectInviteStatus,
  seedGroupForums,
  setProject,
  setShareProfile,
  upsertParticipant,
  type DisposableUser,
} from "../src/db";
import { graphql } from "../src/graphql";
import { inviteToken, waitForInvitePath, waitForVerificationUrl } from "../src/mailbox";
import {
  isMapboxGlStyle,
  openMap,
  signIn,
  visibleButton,
  waitForMapboxStyle,
} from "../src/project";

const created: string[] = [];
const createdUsers: string[] = [];

test.afterEach(async () => {
  for (const slug of created.splice(0)) {
    await hardDeleteProject(slug);
  }
  for (const sub of createdUsers.splice(0)) {
    await deleteE2EUser(sub);
  }
});

function stamp() {
  return `${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
}

function slug(label: string) {
  // projects.slug is varchar(24).
  return `e2e-${label}-${stamp()}`.slice(0, 24);
}

/** Sorts onto the first page of /projects, which lists 12 names at a time. */
function listedName(label: string) {
  return `000 ${label} ${stamp().slice(-4)}`;
}

function projectLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

function contactButton(page: Page) {
  return page.getByRole("button", { name: `Contact ${personas.admin.email}` });
}

async function person(label: string): Promise<DisposableUser> {
  const user = disposableUser(label);
  createdUsers.push(user.sub);
  await createE2EUser(user.sub, user.email);
  return user;
}

async function project(
  request: APIRequestContext,
  input: {
    label: string;
    name: string;
    accessControl: "ADMINS_ONLY" | "INVITE_ONLY" | "PUBLIC";
    isListed: boolean;
  }
) {
  const row = await createAccessProject(request, {
    name: input.name,
    slug: slug(input.label),
    accessControl: input.accessControl,
    isListed: input.isListed,
  });
  created.push(row.slug);
  return row;
}

async function asUser(
  browser: Browser,
  request: APIRequestContext,
  persona: { sub: string; superuser: boolean },
  run: (page: Page) => Promise<void>,
  options?: { emailVerified?: boolean }
) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signIn(page, request, persona, options);
    await run(page);
  } finally {
    await context.close();
  }
}

async function expectMapHidden(page: Page) {
  await expect(page.locator(".mapboxgl-map")).toHaveCount(0);
}

async function expectNonParticipantForums(page: Page) {
  await visibleButton(page, "Discussion Forums").click();
  await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
  await page.getByRole("link", { name: /Welcome to the project/ }).click();
  await expect(
    page.getByText(
      "Consider sharing a user profile and joining this project so you can gain access to the discussion forums."
    )
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Post Reply" })).toHaveCount(0);
}

async function expectSignedInSketching(page: Page) {
  await visibleButton(page, "Sketches").click();
  // Narrow sidebars shorten the label to "Create".
  const tools = page.getByRole("region", { name: "Sketching Tools" });
  await expect(tools.getByRole("button", { name: /^Create/ })).toBeVisible();
  await expect(page.getByText("to start creating sketches")).toHaveCount(0);
}

test.describe("inbound access @enduser @access", () => {
  test("a listed invite-only project offers a request and hides the map", async ({
    page,
    request,
    browser,
  }) => {
    const name = listedName("Invite");
    const row = await project(request, {
      label: "inv",
      name,
      accessControl: "INVITE_ONLY",
      isListed: true,
    });

    await page.goto("/projects");
    await projectLink(page, name).click();
    const anonGate = page.getByRole("dialog");
    await expect(anonGate.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(anonGate.getByText("only be accessed with an invitation")).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Create an account" })).toBeVisible();
    await expectMapHidden(page);

    const visitor = await person("stranger");
    await asUser(browser, request, visitor, async (member) => {
      await member.goto("/projects");
      await projectLink(member, name).click();
      const gate = member.getByRole("dialog");
      await expect(
        gate.getByRole("button", { name: "Share Profile and Request Access" })
      ).toBeVisible();
      await expectMapHidden(member);
      await expect(member).toHaveURL(new RegExp(`/${row.slug}/app`));
    });
  });

  test("a listed admins-only project is on the list and only an admin opens the map", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const name = listedName("Admins");
    const row = await project(request, {
      label: "adm",
      name,
      accessControl: "ADMINS_ONLY",
      isListed: true,
    });

    await page.goto("/projects");
    await projectLink(page, name).click();
    const anonGate = page.getByRole("dialog");
    await expect(anonGate.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(anonGate.getByText("only be accessed by project administrators")).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Create an account" })).toHaveCount(0);
    await expectMapHidden(page);

    const visitor = await person("nonadm");
    await asUser(browser, request, visitor, async (member) => {
      await member.goto(`/${row.slug}`);
      const gate = member.getByRole("dialog");
      await expect(gate.getByRole("heading", { name: "Admins Only" })).toBeVisible();
      await expect(contactButton(member)).toBeVisible();
      await expect(
        member.getByRole("button", { name: "Share Profile and Request Access" })
      ).toHaveCount(0);
      await expectMapHidden(member);
    });

    await asUser(browser, request, personas.admin, async (admin) => {
      await admin.goto("/projects");
      const style = waitForMapboxStyle(admin);
      await projectLink(admin, name).click();
      expect(isMapboxGlStyle(await style)).toBe(true);
      await expect(admin.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
        timeout: 30_000,
      });
      await expect(admin.getByRole("heading", { name: "Admins Only" })).toHaveCount(0);
    });
  });

  test("an administrator finds an unlisted admins-only project on the list", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const name = listedName("Hidden Admins");
    const row = await project(request, {
      label: "hid",
      name,
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Demo Samoa/ })).toBeVisible();
    await expect(projectLink(page, name)).toHaveCount(0);

    const visitor = await person("hidvis");
    await asUser(browser, request, visitor, async (member) => {
      await member.goto("/projects");
      await expect(projectLink(member, name)).toHaveCount(0);
    });

    await asUser(browser, request, personas.admin, async (admin) => {
      await admin.goto("/projects");
      const style = waitForMapboxStyle(admin);
      await projectLink(admin, name).click();
      expect(isMapboxGlStyle(await style)).toBe(true);
      await expect(admin).toHaveURL(new RegExp(`/${row.slug}/app`));
      await expect(admin.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("an approved participant finds an unlisted invite-only project on the list", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const name = listedName("Hidden Invite");
    const row = await project(request, {
      label: "hin",
      name,
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("approved");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Approved",
      email: member.email,
    });

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Demo Samoa/ })).toBeVisible();
    await expect(projectLink(page, name)).toHaveCount(0);

    await asUser(browser, request, member, async (memberPage) => {
      await memberPage.goto("/projects");
      const style = waitForMapboxStyle(memberPage);
      await projectLink(memberPage, name).click();
      expect(isMapboxGlStyle(await style)).toBe(true);
      await expect(memberPage.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
        timeout: 30_000,
      });
      await expect(memberPage.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
    });
  });

  test("a deep link stops at the same gate and keeps the path when allowed", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "deep",
      name: "Deep Link Project",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });

    await page.goto(`/${row.slug}/app/forums`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/app/forums`));
    await expectMapHidden(page);

    await page.goto(`/${row.slug}/app/sketches`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/app/sketches`));
    await expectMapHidden(page);

    const member = await person("deep");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Deep",
      email: member.email,
    });
    await asUser(browser, request, member, async (memberPage) => {
      await openMap(memberPage, `/${row.slug}/app/forums`);
      await expect(memberPage).toHaveURL(new RegExp(`/${row.slug}/app/forums`));
      await expect(memberPage.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
      await visibleButton(memberPage, "Sketches").click();
      await expect(memberPage).toHaveURL(new RegExp(`/${row.slug}/app/sketches`));
    });
  });

  test("an unknown slug says the project was not found", async ({ page }) => {
    const missing = slug("miss");
    await page.goto(`/${missing}`);
    const gate = page.getByRole("dialog");
    await expect(
      gate.getByRole("heading", { name: `Project "${missing}" not found.` })
    ).toBeVisible();
    await expect(gate.getByRole("link", { name: "list of projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    await expect(page.locator('meta[name="prerender-status-code"]')).toHaveAttribute(
      "content",
      "404"
    );
    await expectMapHidden(page);
  });

  test("a deleted project leaves the list and its old url does not show the map", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const name = listedName("Deleted");
    const row = await project(page.request, {
      label: "del",
      name,
      accessControl: "PUBLIC",
      isListed: true,
    });

    await page.goto("/projects");
    await expect(projectLink(page, name)).toBeVisible();
    await setProject(row.slug, { isDeleted: true });
    await page.reload();
    await expect(projectLink(page, name)).toHaveCount(0);

    await page.goto(`/${row.slug}`);
    const gate = page.getByRole("dialog");
    await expect(
      gate.getByRole("heading", { name: `Project "${row.slug}" not found.` })
    ).toBeVisible();
    await expect(gate.getByRole("link", { name: "list of projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    await expect(page.getByRole("button", { name: "Sketches" })).toHaveCount(0);
    await expectMapHidden(page);
  });

  test("a signed-in non-participant sees the map and the join affordances", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const member = await person("map");
    await signIn(page, request, member);
    await openMap(page, "/demo-samoa/app");
    await expectNonParticipantForums(page);
    await expectSignedInSketching(page);
  });

  test("signing in from a project returns to the join form", async ({ page, request }) => {
    const member = await person("prompt");
    await signIn(page, request, member);
    await page.goto("/demo-samoa/app?pj");
    await expect(page).toHaveURL(/\/demo-samoa\/join\?redirectUrl=/);
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();
    await expect(page.locator('input[name="fullname"]')).toBeVisible();
    await expect(page.getByText("How will my profile be used?")).toBeVisible();
  });

  test("skip join is remembered on the next visit", async ({ page, request }) => {
    test.setTimeout(120_000);
    const member = await person("skip");
    await signIn(page, request, member);
    await page.goto("/demo-samoa/app?pj");
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();

    const style = waitForMapboxStyle(page);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/demo-samoa\/app$/);
    expect(isMapboxGlStyle(await style)).toBe(true);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    expect(
      await page.evaluate(() => localStorage.getItem("has-skipped-join-project-prompt"))
    ).toBe("true");

    await expectNonParticipantForums(page);
    await expectSignedInSketching(page);

    await openMap(page, "/demo-samoa/app");
    await expect(page).not.toHaveURL(/\/join/);
    await expect(page.getByRole("heading", { name: "Join this Project" })).toHaveCount(0);
  });

  test("a saved profile opens from the project and keeps a name change", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "prof",
      name: "Profile Project",
      accessControl: "PUBLIC",
      isListed: true,
    });
    const member = await person("profile");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "Before Name",
      email: member.email,
    });
    await signIn(page, request, member);
    await openMap(page, `/${row.slug}/profile`);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Your User Profile" })).toBeVisible();
    const fullName = dialog.locator('input[name="fullname"]');
    await expect(fullName).toHaveValue("Before Name");
    await fullName.fill("After Name");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/app`));

    await page.goto(`/${row.slug}/profile`);
    await expect(page.locator('input[name="fullname"]')).toHaveValue("After Name");
  });

  test("a participant who opens join is sent on to the project", async ({ page, request }) => {
    const row = await project(request, {
      label: "in",
      name: "Already Joined",
      accessControl: "PUBLIC",
      isListed: true,
    });
    const member = await person("joined");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "Already In",
      email: member.email,
    });
    await signIn(page, request, member);
    await page.goto(`/${row.slug}/join`);
    await expect(
      page.getByRole("heading", { name: "You are already a participant in this project" })
    ).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/app`));
  });

  test("an administrator without a shared profile is sent to join, and skip lands on the map", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "apr",
      name: "Admin Profile",
      accessControl: "PUBLIC",
      isListed: true,
    });
    await setShareProfile(row.slug, personas.admin.sub, false);
    await signIn(page, request, personas.admin);
    await page.goto(`/${row.slug}/admin`);
    await expect(
      page.getByRole("heading", {
        name: "The admin dashboard is limited to project participants",
      })
    ).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/join`));

    const style = waitForMapboxStyle(page);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/app$`));
    await expect(page).not.toHaveURL(/\/admin/);
    expect(isMapboxGlStyle(await style)).toBe(true);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("an empty access request does not file a participant", async ({ page, request }) => {
    const row = await project(request, {
      label: "emp",
      name: "Empty Request",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("empty");
    await signIn(page, request, member);
    await page.goto(`/${row.slug}`);
    await page.getByRole("button", { name: "Share Profile and Request Access" }).click();
    await page.locator('input[name="fullname"]').fill("");
    await page.getByRole("button", { name: "Send Request" }).click();
    await expect(page.getByRole("heading", { name: "User Profile" })).toBeVisible();
    await expect(page.getByText("Required")).toBeVisible();
    expect(await participantCount(row.slug, member.sub)).toBe(0);
  });

  test("a denied request stays on the awaiting-approval gate and can be approved later", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "den",
      name: "Denied Request",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("denied");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: false,
      shareProfile: true,
      fullname: "E2E Denied",
      email: member.email,
    });
    const token = await issueToken(request, member);
    const userId = await currentUserId(request, token.accessToken);
    await denyMember(request, row.id, userId);

    await signIn(page, request, member);
    await page.goto(`/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Request Awaiting Approval" })).toBeVisible();
    await expect(contactButton(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share Profile and Request Access" })
    ).toHaveCount(0);
    await expectMapHidden(page);
    expect(await accessRequestIds(request, row.slug)).toContain(userId);

    await approveMember(request, row.id, userId);
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Request Awaiting Approval" })).toHaveCount(0);
  });

  test("an approved participant verifies their email from the local message", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "ver",
      name: "Verify Email",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("verify");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Unverified",
      email: member.email,
    });
    await signIn(page, request, member, { emailVerified: false });
    await page.goto(`/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Email Not Verified" })).toBeVisible();
    await expectMapHidden(page);

    const sentAt = Date.now();
    await page.getByRole("button", { name: "Resend verification email" }).click();
    await expect(page.getByText("Verification email sent. Check your inbox.")).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    const url = await waitForVerificationUrl(member.email, sentAt);
    expect(url).toContain("/verify-email?verification=");
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status()).toBe(302);

    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Email Not Verified" })).toHaveCount(0);
  });

  test("an unverified administrator opens an admins-only project", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "uva",
      name: "Unverified Admin",
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    const admin = await person("uvadmin");
    await upsertParticipant({
      slug: row.slug,
      sub: admin.sub,
      isAdmin: true,
      approved: true,
      shareProfile: true,
      fullname: "E2E Unverified Admin",
      email: admin.email,
    });
    await signIn(page, request, admin, { emailVerified: false });
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Email Not Verified" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Admins Only" })).toHaveCount(0);
  });

  test("an invite to an existing account makes Sign In the primary button", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const name = "Existing Account Invite";
    const row = await project(request, {
      label: "exi",
      name,
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("exists");
    const sentAt = Date.now();
    await inviteMember(request, row.id, member.email, "E2E Existing");
    const invitePath = await waitForInvitePath(member.email, name, sentAt);

    await page.goto(invitePath);
    const signInButton = page.getByRole("button", { name: "Sign In", exact: true });
    const createAccount = page.getByRole("button", { name: "Create an Account", exact: true });
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toHaveClass(/btn-primary/);
    await expect(createAccount).toBeVisible();
    await expect(createAccount).not.toHaveClass(/btn-primary/);
    expect(await projectInviteStatus(row.slug)).not.toBe("CONFIRMED");
  });

  test("a missing or unreadable invite token shows an error", async ({ page }) => {
    await page.goto("/auth/projectInvite");
    await expect(page.getByText(/Search parameter "token" not found/)).toBeVisible();

    await page.goto("/auth/projectInvite?token=not-a-token");
    await expect(page.getByText("Could not parse invite token")).toBeVisible();
  });

  test("an invite that was already accepted does not confirm again", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const name = "Already Accepted Invite";
    const row = await project(request, {
      label: "used",
      name,
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("used");
    const sentAt = Date.now();
    await inviteMember(request, row.id, member.email, "E2E Used");
    const invitePath = await waitForInvitePath(member.email, name, sentAt);
    const token = await issueToken(request, member);
    await graphql(
      request,
      token.accessToken,
      `mutation Confirm($token: String!) {
        confirmProjectInvite(token: $token) { projectSlug wasUsed }
      }`,
      { token: inviteToken(invitePath) }
    );
    expect(await projectInviteStatus(row.slug)).toBe("CONFIRMED");

    await signIn(page, request, member);
    await page.goto(invitePath);
    await expect(page.getByText("This invitation has already been accepted.")).toBeVisible();
    const proceed = page.getByRole("link", { name: /Proceed to the project/ });
    await expect(proceed).toBeVisible();
    await expect(proceed).toHaveAttribute("href", `/${row.slug}`);
    expect(await projectInviteStatus(row.slug)).toBe("CONFIRMED");
  });

  test("an invite that names a group shows that group's forum only", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Group Forum Invite";
    const row = await project(request, {
      label: "grp",
      name,
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const forums = await seedGroupForums(row.slug);
    const member = await person("crew");
    const sentAt = Date.now();
    await inviteMember(request, row.id, member.email, "E2E Crew", false, [forums.groupName]);
    const invitePath = await waitForInvitePath(member.email, name, sentAt);

    await signIn(page, request, member);
    await page.goto(invitePath);
    await expect(page).toHaveURL(new RegExp(`/${row.slug}/join`));
    const style = waitForMapboxStyle(page);
    await page.getByRole("button", { name: "Skip for now" }).click();
    expect(isMapboxGlStyle(await style)).toBe(true);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await visibleButton(page, "Discussion Forums").click();
    await expect(page.getByRole("heading", { name: forums.forumName, level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: forums.otherForumName, level: 3 })).toHaveCount(
      0
    );
    expect(await projectInviteStatus(row.slug)).toBe("CONFIRMED");
  });

  test("a new account returns to a public project signed in", async ({ page, request }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "pub",
      name: "Signup Public",
      accessControl: "PUBLIC",
      isListed: true,
    });
    const member = await person("signup");
    await signIn(page, request, member);
    await openMap(page, `/${row.slug}/app`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
    await expectSignedInSketching(page);
  });

  test("a new account on an invite-only project still has to request access", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "sig",
      name: "Signup Invite",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("siginv");
    await signIn(page, request, member);
    await page.goto(`/${row.slug}`);
    await page.getByRole("button", { name: "Share Profile and Request Access" }).click();
    await page.locator('input[name="fullname"]').fill("E2E Signup");
    await page.getByRole("button", { name: "Send Request" }).click();
    await expect(page.getByRole("heading", { name: "Your Request Has Been Sent" })).toBeVisible();
    await expectMapHidden(page);

    const token = await issueToken(request, member);
    await approveMember(request, row.id, await currentUserId(request, token.accessToken));
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
  });

  test("an approved participant returns from the list and from a direct link", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = listedName("Return");
    const row = await project(request, {
      label: "ret",
      name,
      accessControl: "INVITE_ONLY",
      isListed: true,
    });
    const member = await person("return");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Return",
      email: member.email,
    });
    await signIn(page, request, member);

    await page.goto("/projects");
    const fromList = waitForMapboxStyle(page);
    await projectLink(page, name).click();
    expect(isMapboxGlStyle(await fromList)).toBe(true);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Join this Project" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);

    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
  });

  test("a pending request returns to the awaiting-approval gate", async ({ page, request }) => {
    const row = await project(request, {
      label: "pen",
      name: "Pending Return",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("pending");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: false,
      shareProfile: true,
      fullname: "E2E Pending",
      email: member.email,
    });
    await signIn(page, request, member);
    await page.goto(`/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Request Awaiting Approval" })).toBeVisible();
    await expect(contactButton(page)).toBeVisible();
    await expectMapHidden(page);
  });

  test("a public project that becomes invite-only sorts joiners from strangers", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "flip",
      name: "Was Public",
      accessControl: "PUBLIC",
      isListed: true,
    });
    const stranger = await person("strng");
    const joiner = await person("joiner");
    const approved = await person("kept");
    await upsertParticipant({
      slug: row.slug,
      sub: joiner.sub,
      approved: false,
      shareProfile: true,
      fullname: "E2E Joiner",
      email: joiner.email,
    });
    await upsertParticipant({
      slug: row.slug,
      sub: approved.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Kept",
      email: approved.email,
    });
    await setProject(row.slug, { accessControl: "invite_only" });

    await asUser(browser, request, stranger, async (strangerPage) => {
      await strangerPage.goto(`/${row.slug}`);
      await expect(
        strangerPage.getByRole("button", { name: "Share Profile and Request Access" })
      ).toBeVisible();
      await expectMapHidden(strangerPage);
    });
    await asUser(browser, request, joiner, async (joinerPage) => {
      await joinerPage.goto(`/${row.slug}`);
      await expect(
        joinerPage.getByRole("heading", { name: "Request Awaiting Approval" })
      ).toBeVisible();
      await expectMapHidden(joinerPage);
    });
    const joinerToken = await issueToken(request, joiner);
    const joinerId = await currentUserId(request, joinerToken.accessToken);
    expect(await accessRequestIds(request, row.slug)).toContain(joinerId);

    await signIn(page, request, approved);
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
  });

  test("an invite-only project that becomes admins-only closes the old doors", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "door",
      name: "Door Change",
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    const member = await person("member");
    const pending = await person("pend");
    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Member",
      email: member.email,
    });
    await upsertParticipant({
      slug: row.slug,
      sub: pending.sub,
      approved: false,
      shareProfile: true,
      fullname: "E2E Pending",
      email: pending.email,
    });
    await setProject(row.slug, { accessControl: "admins_only" });

    await asUser(browser, request, member, async (memberPage) => {
      await memberPage.goto(`/${row.slug}`);
      await expect(memberPage.getByRole("heading", { name: "Admins Only" })).toBeVisible();
      await expectMapHidden(memberPage);
    });
    await asUser(browser, request, pending, async (pendingPage) => {
      await pendingPage.goto(`/${row.slug}`);
      const gate = pendingPage.getByRole("dialog");
      await expect(gate.getByRole("heading", { name: "Admins Only" })).toBeVisible();
      await expect(contactButton(pendingPage)).toBeVisible();
      await expect(
        pendingPage.getByRole("button", { name: "Share Profile and Request Access" })
      ).toHaveCount(0);
      await expectMapHidden(pendingPage);
    });

    await signIn(page, request, personas.admin);
    await page.goto(`/${row.slug}/admin/users`);
    await expect(page.getByRole("link", { name: /Participants/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Access Requests/ })).toHaveCount(0);
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Admins Only" })).toHaveCount(0);
  });

  test("an admins-only project that becomes public opens the map", async ({ page, request }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "open",
      name: "Becomes Public",
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    await page.goto(`/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expectMapHidden(page);

    await setProject(row.slug, { accessControl: "public", isListed: true });
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
  });

  test("unlisting hides a project from strangers and a public project stays listed", async ({
    page,
    request,
    browser,
  }) => {
    const inviteName = listedName("Unlist");
    const invite = await project(request, {
      label: "unl",
      name: inviteName,
      accessControl: "INVITE_ONLY",
      isListed: true,
    });
    const member = await person("listed");
    await upsertParticipant({
      slug: invite.slug,
      sub: member.sub,
      approved: true,
      shareProfile: true,
      fullname: "E2E Listed",
      email: member.email,
    });

    await page.goto("/projects");
    await expect(projectLink(page, inviteName)).toBeVisible();
    await setProject(invite.slug, { isListed: false });
    await page.reload();
    await expect(projectLink(page, inviteName)).toHaveCount(0);
    await asUser(browser, request, member, async (memberPage) => {
      await memberPage.goto("/projects");
      await expect(projectLink(memberPage, inviteName)).toBeVisible();
    });

    const publicName = listedName("Stays");
    const listed = await project(request, {
      label: "stay",
      name: publicName,
      accessControl: "PUBLIC",
      isListed: true,
    });
    const admin = await issueToken(request, personas.admin);
    await expect(
      graphql(
        request,
        admin.accessToken,
        `mutation Unlist($slug: String!) {
          updateProjectBySlug(input: { slug: $slug, patch: { isListed: false } }) {
            project { id }
          }
        }`,
        { slug: listed.slug }
      )
    ).rejects.toThrow();
    await page.goto("/projects");
    await expect(projectLink(page, publicName)).toBeVisible();
  });

  test("promotion lets a stopped person open an admins-only project", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const row = await project(request, {
      label: "pro",
      name: "Promotion",
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    const member = await person("promo");
    await signIn(page, request, member);
    await page.goto(`/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Admins Only" })).toBeVisible();
    await expectMapHidden(page);

    await upsertParticipant({
      slug: row.slug,
      sub: member.sub,
      isAdmin: true,
      approved: true,
      shareProfile: true,
      fullname: "E2E Promo",
      email: member.email,
    });
    await openMap(page, `/${row.slug}`);
    await expect(page.getByRole("heading", { name: "Admins Only" })).toHaveCount(0);
  });
});
