import {
  accessSupportReason,
  contactEmailProblem,
  inviteSupportMailto,
  mailtoHref,
  normalizeContactEmail,
  projectSupportMailto,
  SEASKETCH_SUPPORT_EMAIL,
} from "./contactEmail";

describe("contact email", () => {
  test("trims surrounding space", () => {
    expect(normalizeContactEmail("  planning@example.org  ")).toBe(
      "planning@example.org"
    );
  });

  test("requires an address", () => {
    expect(contactEmailProblem("")).toBe("required");
    expect(contactEmailProblem("   ")).toBe("required");
  });

  test("rejects values that are not email addresses", () => {
    expect(contactEmailProblem("not-an-email")).toBe("invalid");
    expect(contactEmailProblem("missing-domain@")).toBe("invalid");
    expect(contactEmailProblem("spaces in@example.org")).toBe("invalid");
  });

  test("accepts a normal address", () => {
    expect(contactEmailProblem("planning@example.org")).toBeUndefined();
    expect(contactEmailProblem("  Admin@Example.Test ")).toBeUndefined();
  });

  test("adds a subject when one is provided", () => {
    expect(mailtoHref("planning@example.org")).toBe(
      "mailto:planning@example.org"
    );
    expect(mailtoHref("planning@example.org", "Access request")).toBe(
      "mailto:planning@example.org?subject=Access%20request"
    );
    expect(
      mailtoHref("planning@example.org", "Access request", "Project: Coast")
    ).toBe(
      "mailto:planning@example.org?subject=Access%20request&body=Project%3A%20Coast"
    );
  });

  test("fills a support message with the invitation details it has", () => {
    const href = inviteSupportMailto({
      error: "Could not parse invite token",
      projectName: "Coastal Plan",
      projectSlug: "coastal-plan",
      recipientEmail: "ada@example.test",
      inviteId: 7,
      signedInEmail: "someone@example.test",
      pageUrl: "http://localhost/auth/projectInvite?token=abc",
    });
    expect(href.startsWith(`mailto:${SEASKETCH_SUPPORT_EMAIL}?`)).toBe(true);
    const body = decodeURIComponent(href.split("body=")[1]);
    expect(body).toContain("Error: Could not parse invite token");
    expect(body).toContain("Project: Coastal Plan");
    expect(body).toContain("Project address: coastal-plan");
    expect(body).toContain("Invitation for: ada@example.test");
    expect(body).toContain("Invite id: 7");
    expect(body).toContain("Signed in as: someone@example.test");
    expect(body).toContain("Page: http://localhost/auth/projectInvite?token=abc");
    expect(decodeURIComponent(href)).toContain(
      "subject=SeaSketch invitation: Could not parse invite token"
    );
  });

  test("leaves out details that are not known", () => {
    const body = decodeURIComponent(
      inviteSupportMailto({ error: "Search parameter token not found." }).split(
        "body="
      )[1]
    );
    expect(body).toContain("Error: Search parameter token not found.");
    expect(body).not.toContain("Project:");
    expect(body).not.toContain("Signed in as:");
    expect(body).not.toContain("Page:");
  });

  test("drops a page address that would make the link too long", () => {
    const href = inviteSupportMailto({
      error: "Could not parse invite token",
      pageUrl: "http://localhost/auth/projectInvite?token=" + "a".repeat(4000),
    });
    expect(href.length).toBeLessThanOrEqual(1800);
    expect(decodeURIComponent(href)).not.toContain("Page:");
    expect(decodeURIComponent(href)).toContain("Could not parse invite token");
  });

  test("writes an access request to the project address", () => {
    const href = projectSupportMailto({
      supportEmail: "planning@example.org",
      projectName: "Coastal Plan",
      projectSlug: "coastal-plan",
      reason: accessSupportReason.adminsOnly,
      visitorEmail: "ada@example.test",
      pageUrl: "http://localhost/coastal-plan",
    });
    expect(href.startsWith("mailto:planning@example.org?")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("subject=SeaSketch access: Coastal Plan");
    expect(decoded).toContain(accessSupportReason.adminsOnly);
    expect(decoded).toContain("Signed in as: ada@example.test");
    expect(decoded).toContain("Page: http://localhost/coastal-plan");
  });

  test("uses SeaSketch support when the project has no address", () => {
    const href = projectSupportMailto({
      supportEmail: "  ",
      reason: accessSupportReason.notFound,
    });
    expect(href.startsWith(`mailto:${SEASKETCH_SUPPORT_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(href)).toContain(accessSupportReason.notFound);
    expect(decodeURIComponent(href)).not.toContain("Signed in as:");
  });
});
