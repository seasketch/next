/* eslint-disable i18next/no-literal-string */
import { render, screen, waitFor } from "@testing-library/react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AccessGranted,
  Error404,
  Loading,
  DeniedAdminsOnly,
  DeniedAdminsOnlyAndAnon,
  DeniedEmailNotVerified,
  DeniedInviteOnly,
  DeniedNotApproved,
} from "./ProjectAccessGate.stories";
jest.mock("@auth0/auth0-react");

beforeEach(() => {
  // @ts-ignore
  useAuth0.mockReturnValue({
    isAuthenticated: false,
    user: null,
    logout: jest.fn(),
    loginWithRedirect: jest.fn(),
  });

  // Silence apollo inmemorycache console.error calls based on incomplete mocks
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

test("Loading screen displays an svg indicator", async () => {
  render(<Loading />);
  await waitFor(() => {
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

test("Project is visible if loaded and granted access", async () => {
  render(<AccessGranted />);
  await waitFor(() => {
    expect(screen.getByText(/Project Name/)).toBeInTheDocument();
  });
});

test("Error is shown if project doesn't exist", async () => {
  render(<Error404 />);
  await waitFor(() => {
    expect(screen.getByText(/Project "cburt" not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "list of projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    expect(screen.getByRole("link", { name: "support@seasketch.org" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:support@seasketch.org?")
    );
  });
});

test("Unauthorized users are blocked by admin-only projects and given the support email", async () => {
  render(<DeniedAdminsOnly />);
  await waitFor(() => {
    expect(screen.getByText(/administrators/)).toBeInTheDocument();
    const support = screen.getByRole("link", { name: "chad@underbluewaters.net" });
    expect(decodeURIComponent(support.getAttribute("href") || "")).toContain(
      "mailto:chad@underbluewaters.net?"
    );
  });
});

test("Anonymous visitors to an admins-only project can write the project", async () => {
  render(<DeniedAdminsOnlyAndAnon />);
  await waitFor(() => {
    expect(screen.getByText(/only be accessed by project administrators/)).toBeInTheDocument();
  });
  const support = screen.getByRole("link", { name: "chad@underbluewaters.net" });
  const href = decodeURIComponent(support.getAttribute("href") || "");
  expect(href.startsWith("mailto:chad@underbluewaters.net?")).toBe(true);
  expect(href).toContain("Chad's Project");
  expect(href).toContain("project administrators");
});

test("Privileged access projects require a verified email", async () => {
  render(<DeniedEmailNotVerified />);
  await waitFor(() => {
    expect(screen.getByText(/verify/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "chad@underbluewaters.net" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:chad@underbluewaters.net?")
    );
  });
});

test("Invite-only projects deny access to unauthorized users", async () => {
  render(<DeniedInviteOnly />);
  await waitFor(() => {
    expect(screen.getByText(/invitation/)).toBeInTheDocument();
    expect(screen.getByText(/chad@underbluewaters.net/)).toBeInTheDocument();
  });
});

test("Users with un-approved invite requests are blocked", async () => {
  render(<DeniedNotApproved />);
  await waitFor(() => {
    expect(screen.getByText(/approved/)).toBeInTheDocument();
  });
});
