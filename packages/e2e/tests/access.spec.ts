import { expect, test } from "@playwright/test";
import {
  approveMember,
  createAccessProject,
  currentUserId,
  inviteMember,
} from "../src/accessProject";
import { personas } from "../src/config";
import {
  clearMemberProfile,
  createE2EUser,
  deleteE2EUser,
  expireInviteToken,
  hardDeleteProject,
  projectInviteStatus,
} from "../src/db";
import { inviteToken, waitForInvitePath } from "../src/mailbox";
import { isMapboxGlStyle, openMap, signIn, visibleNavLink, waitForMapboxStyle } from "../src/project";

const created: string[] = [];
const createdUsers: string[] = [];

test.afterEach(async () => {
  for (const slug of created.splice(0)) {
    await hardDeleteProject(slug);
  }
  for (const sub of createdUsers.splice(0)) {
    await deleteE2EUser(sub);
  }
  await clearMemberProfile();
});

function slug(label: string) {
  // projects.slug is varchar(24).
  return `e2e-${label}-${Date.now().toString(36)}`.slice(0, 24);
}

test.describe("access @access", () => {
  test("an anonymous visitor opens a public project from the list", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Demo Samoa/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Private", exact: true })).toHaveCount(0);

    const style = waitForMapboxStyle(page);
    await page.getByRole("link", { name: /Demo Samoa/ }).click();
    expect(isMapboxGlStyle(await style)).toBe(true);
    await expect(page).toHaveURL(/\/demo-samoa\/app/);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("an admins-only project admits its admin and no one else", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const name = "Access Admins Only";
    const project = await createAccessProject(request, {
      name,
      slug: slug("admins"),
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Demo Samoa/ })).toBeVisible();
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);

    await page.goto(`/${project.slug}`);
    const anonGate = page.getByRole("dialog");
    await expect(anonGate.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(anonGate.getByText("only be accessed by project administrators")).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Create an account" })).toHaveCount(0);
    await expect(page.locator(".mapboxgl-map")).toHaveCount(0);

    const memberContext = await browser.newContext();
    try {
      const memberPage = await memberContext.newPage();
      await signIn(memberPage, request, personas.member);
      await memberPage.goto(`/${project.slug}`);
      const memberGate = memberPage.getByRole("dialog");
      await expect(memberGate.getByRole("heading", { name: "Admins Only" })).toBeVisible();
      await expect(memberGate.getByText("limited to project administrators")).toBeVisible();
      await expect(memberPage.locator(".mapboxgl-map")).toHaveCount(0);
      await expect(
        memberPage.getByRole("button", { name: "Project Admin Dashboard" })
      ).toHaveCount(0);
    } finally {
      await memberContext.close();
    }

    await signIn(page, request, personas.admin);
    await openMap(page, `/${project.slug}`);
    await expect(page.getByRole("button", { name: "Project Admin Dashboard" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Admins Only", exact: true })
    ).toHaveCount(0);
  });

  test("an invite-only project stays unlisted and asks a visitor to sign in", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(90_000);
    const name = "Access Invite Only";
    const project = await createAccessProject(request, {
      name,
      slug: slug("invite-gate"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Demo Samoa/ })).toBeVisible();
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);

    await page.goto(`/${project.slug}`);
    const anonGate = page.getByRole("dialog");
    await expect(anonGate.getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(anonGate.getByText("only be accessed with an invitation")).toBeVisible();
    await expect(anonGate.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(
      anonGate.getByRole("button", { name: "Create an account" })
    ).toBeVisible();
    await expect(page.locator(".mapboxgl-map")).toHaveCount(0);

    const memberContext = await browser.newContext();
    try {
      const memberPage = await memberContext.newPage();
      await signIn(memberPage, request, personas.member);
      await memberPage.goto(`/${project.slug}`);
      const memberGate = memberPage.getByRole("dialog");
      await expect(memberGate.getByRole("heading", { name: "Private Project" })).toBeVisible();
      await expect(
        memberGate.getByRole("button", { name: "Share Profile and Request Access" })
      ).toBeVisible();
      await expect(memberPage.locator(".mapboxgl-map")).toHaveCount(0);
    } finally {
      await memberContext.close();
    }
  });

  test("a member requests access and sees the project after an admin approves", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Access Request";
    const project = await createAccessProject(request, {
      name,
      slug: slug("request"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const member = await signIn(page, request, personas.member);
    await page.goto(`/${project.slug}`);
    await page.getByRole("button", { name: "Share Profile and Request Access" }).click();
    await expect(page.getByRole("heading", { name: "User Profile" })).toBeVisible();

    await page.locator('input[name="fullname"]').fill("E2E Requester");
    await page.getByRole("button", { name: "Send Request" }).click();
    await expect(page.getByRole("heading", { name: "Your Request Has Been Sent" })).toBeVisible();
    await expect(page.locator(".mapboxgl-map")).toHaveCount(0);

    await approveMember(request, project.id, await currentUserId(request, member.accessToken));

    await openMap(page, `/${project.slug}`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("a member accepts an email invite and opens the project", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Access Invite Acceptance";
    const project = await createAccessProject(request, {
      name,
      slug: slug("accept"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const sentAt = Date.now();
    await inviteMember(request, project.id, personas.member.email, "E2E Member");
    const invitePath = await waitForInvitePath(personas.member.email, name, sentAt);

    await signIn(page, request, personas.member);
    await page.goto(invitePath);
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/join`));
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByRole("button", { name: "Skip for now" }).click();
    await openMap(page, `/${project.slug}/app`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);

    expect(await projectInviteStatus(project.slug)).toBe("CONFIRMED");
  });

  test("a signed-out visitor opens an invite and is asked to sign in", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const name = "Access Logged Out Invite";
    const project = await createAccessProject(request, {
      name,
      slug: slug("out"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const sentAt = Date.now();
    await inviteMember(request, project.id, personas.member.email, "E2E Member");
    const invitePath = await waitForInvitePath(personas.member.email, name, sentAt);

    await page.goto(invitePath);
    await expect(page).toHaveURL(/\/auth\/projectInvite\?token=/);
    await expect(
      page.getByText("You have been invited to participate in a SeaSketch project.")
    ).toBeVisible();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create an Account", exact: true })
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/join/);

    expect(await projectInviteStatus(project.slug)).not.toBe("CONFIRMED");
  });

  test("an admin invite lets a member into an admins-only project", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Access Admin Invite";
    const project = await createAccessProject(request, {
      name,
      slug: slug("adm"),
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    await signIn(page, request, personas.member);
    await page.goto(`/${project.slug}`);
    await expect(page.getByRole("heading", { name: "Admins Only" })).toBeVisible();
    await expect(page.locator(".mapboxgl-map")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Project Admin Dashboard" })).toHaveCount(0);

    const sentAt = Date.now();
    await inviteMember(request, project.id, personas.member.email, "E2E Member", true);
    const invitePath = await waitForInvitePath(personas.member.email, name, sentAt);

    await page.goto(invitePath);
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/join`));
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();

    // Confirming the invite grants admin with share_profile still false. The
    // admin page stays closed until the profile is shared.
    await page.locator('input[name="fullname"]').fill("E2E Admin Invitee");
    await page.getByRole("button", { name: "Join Project", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/app`));
    await expect(page.getByRole("heading", { name: "Admins Only", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Project Admin Dashboard" }).click();
    await expect(visibleNavLink(page, "Users & Groups")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/admin`));
    await expect(
      page.getByRole("heading", { name: "The admin dashboard is limited to project participants" })
    ).toHaveCount(0);

    expect(await projectInviteStatus(project.slug)).toBe("CONFIRMED");
  });

  test("an anonymous visitor accepts an admin invite for a new account", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Access New Admin Invite";
    const project = await createAccessProject(request, {
      name,
      slug: slug("new"),
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const stamp = Date.now().toString(36);
    const email = `invitee-${stamp}@example.test`;
    const sub = `e2e|invitee-${stamp}`;
    createdUsers.push(sub);

    const sentAt = Date.now();
    await inviteMember(request, project.id, email, "E2E New Admin", true);
    const invitePath = await waitForInvitePath(email, name, sentAt);

    await page.goto(invitePath);
    await expect(page).toHaveURL(/\/auth\/projectInvite\?token=/);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const createAccount = page.getByRole("button", { name: "Create an Account", exact: true });
    const signInButton = page.getByRole("button", { name: "Sign In", exact: true });
    await expect(createAccount).toBeVisible();
    await expect(createAccount).toHaveClass(/btn-primary/);
    await expect(signInButton).toBeVisible();
    await expect(signInButton).not.toHaveClass(/btn-primary/);
    expect(await projectInviteStatus(project.slug)).not.toBe("CONFIRMED");

    // Create an Account leaves for Auth0. The account is the row a first
    // login would insert, and the next page is the URL that button returns to.
    await createE2EUser(sub, email);
    await signIn(page, request, { sub, superuser: false });
    await page.goto(invitePath.replace("/auth/projectInvite?", "/auth/projectInvite/confirm?"));
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/join`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();

    await page.locator('input[name="fullname"]').fill("E2E New Admin");
    await page.getByRole("button", { name: "Join Project", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/app`));
    await expect(page.getByRole("heading", { name: "Admins Only", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Project Admin Dashboard" }).click();
    await expect(visibleNavLink(page, "Users & Groups")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/admin`));

    expect(await projectInviteStatus(project.slug)).toBe("CONFIRMED");
  });

  test("a signed-in account can accept an invite sent to a different email", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const name = "Access Second Account";
    const project = await createAccessProject(request, {
      name,
      slug: slug("other"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const stamp = Date.now().toString(36);
    const otherSub = `e2e|other-${stamp}`;
    const otherEmail = `other-${stamp}@example.test`;
    createdUsers.push(otherSub);
    await createE2EUser(otherSub, otherEmail);

    const sentAt = Date.now();
    await inviteMember(request, project.id, personas.member.email, "E2E Member");
    const invitePath = await waitForInvitePath(personas.member.email, name, sentAt);

    // Logout and sign in would leave for Auth0. Accept as the current account
    // is the choice this suite can finish.
    await signIn(page, request, { sub: otherSub, superuser: false });
    await page.goto(invitePath);
    await expect(page).toHaveURL(/\/auth\/projectInvite\?token=/);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(
      page.getByText(`This invitation was originally sent to ${personas.member.email}`)
    ).toBeVisible();
    await expect(
      page.getByText("An account with this email address already exists.")
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Logout and sign in as ${personas.member.email}`,
      })
    ).toBeVisible();
    const acceptAs = page.getByRole("button", { name: `Accept as ${otherEmail}` });
    await expect(acceptAs).toBeVisible();
    expect(await projectInviteStatus(project.slug)).not.toBe("CONFIRMED");

    await acceptAs.click();
    await expect(page).toHaveURL(new RegExp(`/${project.slug}/join`));
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await openMap(page, `/${project.slug}/app`);
    await expect(page.getByRole("heading", { name: "Private Project" })).toHaveCount(0);

    expect(await projectInviteStatus(project.slug)).toBe("CONFIRMED");
  });

  test("an expired invite tells the visitor and stays unconfirmed", async ({ page, request }) => {
    test.setTimeout(90_000);
    const name = "Access Expired Invite";
    const project = await createAccessProject(request, {
      name,
      slug: slug("expired"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    const sentAt = Date.now();
    await inviteMember(request, project.id, personas.member.email, "E2E Member");
    const invitePath = await waitForInvitePath(personas.member.email, name, sentAt);
    const expired = await expireInviteToken(inviteToken(invitePath));

    await page.goto(`/auth/projectInvite?token=${encodeURIComponent(expired)}`);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(
      page.getByText("Your invitation to this project has expired.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Join Project", exact: true })).toHaveCount(0);

    expect(await projectInviteStatus(project.slug)).not.toBe("CONFIRMED");
  });
});
