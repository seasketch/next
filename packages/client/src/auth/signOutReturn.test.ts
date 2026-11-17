import { ProjectAccessControlSetting } from "../generated/graphql";
import {
  applyRememberedSignOutReturn,
  projectPathAfterSignOut,
  rememberSignOutReturn,
} from "./signOutReturn";

const publicListed = {
  accessControl: ProjectAccessControlSetting.Public,
  isListed: true,
  slug: "demo-samoa",
};

describe("projectPathAfterSignOut", () => {
  test("stays on a public listed project map", () => {
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        pathname: "/demo-samoa/app",
      })
    ).toBe("/demo-samoa/app");
  });

  test("keeps the public project path and query", () => {
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        pathname: "/demo-samoa/app/forums",
        search: "?topic=1",
      })
    ).toBe("/demo-samoa/app/forums?topic=1");
  });

  test("leaves the admin screen for the public project map", () => {
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        pathname: "/demo-samoa/admin/settings",
      })
    ).toBe("/demo-samoa/app");
  });

  test("sends an unlisted project home", () => {
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        isListed: false,
        pathname: "/demo-samoa/app",
      })
    ).toBeNull();
  });

  test("sends invite-only and admins-only projects home", () => {
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        accessControl: ProjectAccessControlSetting.InviteOnly,
        pathname: "/demo-samoa/app",
      })
    ).toBeNull();
    expect(
      projectPathAfterSignOut({
        ...publicListed,
        accessControl: ProjectAccessControlSetting.AdminsOnly,
        pathname: "/demo-samoa/app",
      })
    ).toBeNull();
  });
});

describe("rememberSignOutReturn", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test("stores a project path and applies it only from the site root", () => {
    rememberSignOutReturn("/demo-samoa/app");
    window.history.replaceState(null, "", "/");
    applyRememberedSignOutReturn();
    expect(window.location.pathname).toBe("/demo-samoa/app");
    expect(sessionStorage.getItem("seasketch.signOutReturn")).toBeNull();
  });

  test("drops a stored path that is not a project", () => {
    sessionStorage.setItem("seasketch.signOutReturn", "https://example.com");
    window.history.replaceState(null, "", "/");
    applyRememberedSignOutReturn();
    expect(window.location.pathname).toBe("/");
  });

  test("clears a stored path when the next sign-out has nowhere to return", () => {
    rememberSignOutReturn("/demo-samoa/app");
    rememberSignOutReturn(null);
    window.history.replaceState(null, "", "/");
    applyRememberedSignOutReturn();
    expect(window.location.pathname).toBe("/");
  });
});
