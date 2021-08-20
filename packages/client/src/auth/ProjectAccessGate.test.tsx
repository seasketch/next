/* eslint-disable i18next/no-literal-string */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ProjectAccessGate } from "./ProjectAccessGate";
import { MockedProvider } from "@apollo/client/testing";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AccessGranted,
  AdminsOnly,
  Error404,
  Loading,
  AccessRequestScreen,
  DeniedAdminsOnly,
  DeniedAnon,
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
  render(<AdminsOnly />);
  await waitFor(() => {
    expect(screen.getByText(/administrators/)).toBeInTheDocument();
    expect(screen.getByText(/chad@underbluewaters.net/)).toBeInTheDocument();
  });
});
