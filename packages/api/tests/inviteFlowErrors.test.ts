import {
  mapInviteConfirmationError,
  mapJwtVerificationError,
} from "../src/invites/inviteFlowErrors";

describe("inviteFlowErrors", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("mapJwtVerificationError preserves jwt expired wording for client routing", () => {
    const e = new Error("jwt expired");
    expect(mapJwtVerificationError(e).message).toBe("jwt expired");
  });

  test("mapJwtVerificationError maps invalid tokens and chains cause", () => {
    const inner = new Error("invalid signature");
    const out = mapJwtVerificationError(inner);
    expect(out.message).toMatch(/most recent invitation/i);
    expect((out as Error & { cause?: unknown }).cause).toBe(inner);
  });

  test("mapInviteConfirmationError maps 22P02 (invalid integer / bad session)", () => {
    const inner = Object.assign(
      new Error("invalid input syntax for type integer"),
      { code: "22P02" }
    );
    const out = mapInviteConfirmationError(inner);
    expect(out.message).toMatch(/session/i);
    expect(out.message).toMatch(/sign out/i);
    expect((out as Error & { cause?: unknown }).cause).toBe(inner);
  });

  test("mapInviteConfirmationError maps permission denied on users table", () => {
    const inner = new Error('permission denied for table "users"');
    const out = mapInviteConfirmationError(inner);
    expect(out.message).toMatch(/permission/i);
    expect(out.message).toMatch(/sign out/i);
    expect((out as Error & { cause?: unknown }).cause).toBe(inner);
  });

  test("mapInviteConfirmationError maps missing invite from confirm_project_invite", () => {
    const inner = new Error("Cannot find invite with id 999");
    const out = mapInviteConfirmationError(inner);
    expect(out.message).toMatch(/no longer valid/i);
    expect((out as Error & { cause?: unknown }).cause).toBe(inner);
  });
});
