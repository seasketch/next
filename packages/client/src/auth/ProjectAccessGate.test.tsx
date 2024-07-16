/* eslint-disable i18next/no-literal-string */
import { render, screen, waitFor } from "@testing-library/react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AccessGranted,
  Error404,
  Loading,
  DeniedAdminsOnly,
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
    expect(screen.getByText(/Error Loading Project/)).toBeInTheDocument();
  });
});

test("Unauthorized users are blocked by admin-only projects and given the support email", async () => {
  render(<DeniedAdminsOnly />);
  await waitFor(() => {
    expect(screen.getByText(/administrators/)).toBeInTheDocument();
    expect(screen.getByText(/chad@underbluewaters.net/)).toBeInTheDocument();
  });
});

test("Privileged access projects require a verified email", async () => {
  render(<DeniedEmailNotVerified />);
  await waitFor(() => {
    expect(screen.getByText(/verify/)).toBeInTheDocument();
  });
});

test("Invite-only projects deny access to unauthorized users", async () => {
  render(<DeniedInviteOnly />);
  await waitFor(() => {
    expect(screen.getByText(/invitation/)).toBeInTheDocument();
  });
});

test("Users with un-approved invite requests are blocked", async () => {
  render(<DeniedNotApproved />);
  await waitFor(() => {
    expect(screen.getByText(/approved/)).toBeInTheDocument();
  });
});
