/* eslint-disable i18next/no-literal-string */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Landing from "./ProjectInviteLanding";
import { createMemoryHistory } from "history";
import "@testing-library/jest-dom/extend-expect";
import { Router } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import {
  ConfirmProjectInviteDocument,
  ProjectInviteTokenClaims,
  VerifyProjectInviteDocument,
} from "../generated/graphql";
import jwt from "jsonwebtoken";
import { useAuth0 } from "@auth0/auth0-react";
import {
  ExpiredInvitation,
  InvalidToken,
  ValidInviteUnknownEmail,
  ValidInviteSentToKnownEmail,
  LoggedInAsDifferentUser,
  LoggedInAsDifferentUserWhichHasExistingAccount,
} from "./ProjectInviteLanding.stories";

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
});

it("renders without crashing", () => {
  render(<InvalidToken />);
});

describe("Ingress initial scenarios", () => {
  test("Invalid invitation", () => {
    render(<InvalidToken />);
    expect(screen.getByText(/could not parse/i)).toBeInTheDocument();
  });

  test("Expired invitation", async () => {
    render(<ExpiredInvitation />);
    await waitFor(() => {
      // Should show a message stating the invite is expired
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
      // TODO: should show the admin email so they can be contacted
    });
  });

  describe("Anonymous user", () => {
    test("with invite sent to unregistered email", async () => {
      render(<ValidInviteUnknownEmail />);
      await waitFor(() => {
        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/exists/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Sign In/i, {
          selector: ".btn-primary",
        })
      ).not.toBeInTheDocument();
      // Creating an account should be the primary action since we know no matching account exists
      expect(
        screen.queryByText(/Account/i, {
          selector: ".btn-primary",
        })
      ).toBeInTheDocument();
    });
    test("with invite sent to known registered email", async () => {
      render(<ValidInviteSentToKnownEmail />);
      await waitFor(() => {
        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/exists/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Account/i, {
          selector: ".btn-primary",
        })
      ).not.toBeInTheDocument();
      // Sign In link should be highlighted since we know an existing account already exists
      expect(
        screen.queryByText(/Sign In/i, {
          selector: ".btn-primary",
        })
      ).toBeInTheDocument();
    });
  });

  describe("Signed in user", () => {
    test("with invite sent to self", async () => {
      const loginWithRedirect = jest.fn();
      // @ts-ignore
      useAuth0.mockReturnValueOnce({
        isAuthenticated: true,
        user: {
          email: "test@example.com",
        },
        logout: jest.fn(),
        loginWithRedirect,
      });
      const history = createMemoryHistory();
      const claims: ProjectInviteTokenClaims = {
        email: "test@example.com",
        projectName: "Test Project",
        projectSlug: "test",
        admin: false,
        inviteId: 1,
        wasUsed: false,
        projectId: 1,
      };
      const token = jwt.sign(claims, "secret", {
        expiresIn: "1 day",
      });
      history.push({
        pathname: "/auth/projectInvite",
        search: `?token=${token}`,
      });
      const verifyFn = jest.fn(() => ({
        data: {
          verifyProjectInvite: {
            claims,
            existingAccount: true,
          },
        },
      }));
      const confirmFn = jest.fn(() => ({
        data: {
          confirmProjectInvite: {
            projectSlug: "test",
          },
        },
      }));
      render(
        <Router history={history}>
          <MockedProvider
            mocks={[
              {
                request: {
                  query: VerifyProjectInviteDocument,
                  variables: {
                    token,
                  },
                },
                result: verifyFn,
              },
              {
                request: {
                  query: ConfirmProjectInviteDocument,
                  variables: {
                    token,
                  },
                },
                result: confirmFn,
              },
            ]}
          >
            <Landing />
          </MockedProvider>
        </Router>
      );

      // User should be automatically signed in
      await waitFor(async () => {
        expect(verifyFn).toBeCalledTimes(1);
        expect(confirmFn).toBeCalledTimes(1);
        // User should be redirected to the project page
      });
      expect(history.location.pathname).toBe("/test/join");
    });

    test("with invite sent to different email address", async () => {
      // @ts-ignore
      useAuth0.mockReturnValue({
        isAuthenticated: true,
        user: {
          email: "userA@example.com",
        },
        logout: jest.fn(),
        loginWithRedirect: jest.fn(),
      });
      render(<LoggedInAsDifferentUser />);
      await waitFor(() => {
        // User should be given option to accept with current account
        expect(
          screen.getByText(/accept as userA@example.com/i)
        ).toBeInTheDocument();
      });
      // Or to logout and login/register under a different account
      expect(screen.getByText(/another account/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/accept/i, {
          selector: ".btn-primary",
        })
      ).toBeInTheDocument();
    });

    test("with invite sent to different email address, for which an account already exists", async () => {
      // @ts-ignore
      useAuth0.mockReturnValue({
        isAuthenticated: true,
        user: {
          email: "userA@example.com",
        },
        logout: jest.fn(),
        loginWithRedirect: jest.fn(),
      });
      render(<LoggedInAsDifferentUserWhichHasExistingAccount />);
      await waitFor(() => {
        // User should be given option to accept with current account still
        expect(
          screen.getByText(/accept as userA@example.com/i)
        ).toBeInTheDocument();
        // but using the existing account should be encouraged
        expect(screen.getByText(/logout/i)).toBeInTheDocument();
        expect(
          screen.queryByText(/logout/i, {
            selector: ".btn-primary",
          })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Following thru with actions", () => {
    describe("Anon users", () => {
      test("Signing in or registering redirects to confirmation page", async () => {
        const history = createMemoryHistory();
        const claims: ProjectInviteTokenClaims = {
          email: "test@example.com",
          projectName: "Test Project",
          projectSlug: "test",
          admin: false,
          inviteId: 1,
          wasUsed: false,
          projectId: 1,
        };
        const token = jwt.sign(claims, "secret", {
          expiresIn: "1 day",
        });
        history.push({
          pathname: "/auth/projectInvite",
          search: `?token=${token}`,
        });
        const verifyFn = jest.fn(() => ({
          data: {
            verifyProjectInvite: {
              claims,
              existingAccount: true,
            },
          },
        }));
        const confirmFn = jest.fn(() => ({
          data: {
            confirmProjectInvite: {
              projectSlug: "test",
            },
          },
        }));
        const loginWithRedirect = jest.fn();
        const logout = jest.fn();

        // @ts-ignore
        useAuth0.mockReturnValue({
          isAuthenticated: false,
          user: null,
          logout,
          loginWithRedirect: loginWithRedirect,
        });
        render(
          <Router history={history}>
            <MockedProvider
              mocks={[
                {
                  request: {
                    query: VerifyProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: verifyFn,
                },
                {
                  request: {
                    query: ConfirmProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: confirmFn,
                },
              ]}
            >
              <Landing />
            </MockedProvider>
          </Router>
        );
        await waitFor(() => {
          expect(screen.getByText(/sign in/i)).toBeInTheDocument();
          expect(verifyFn).toBeCalledTimes(1);
        });
        fireEvent.click(screen.getByText(/sign in/i));
        // login should be called with redirect to confirmation page
        expect(loginWithRedirect).toBeCalledWith(
          expect.objectContaining({
            authorizationParams: expect.objectContaining({
              redirect_uri: `http://localhost/auth/projectInvite/confirm?token=${token}`,
            }),
            appState: expect.objectContaining({
              projectInvite: expect.objectContaining({
                email: "test@example.com",
              }),
              tokenString: token,
            }),
          })
        );
      });
    });
    describe("Authenticated users", () => {
      test("Accepting invite as current user confirms invite and redirects to project homepage", async () => {
        const history = createMemoryHistory();
        const claims: ProjectInviteTokenClaims = {
          email: "test@example.com",
          projectName: "Test Project",
          projectSlug: "test",
          admin: false,
          inviteId: 1,
          wasUsed: false,
          projectId: 1,
        };
        const token = jwt.sign(claims, "secret", {
          expiresIn: "1 day",
        });
        history.push({
          pathname: "/auth/projectInvite",
          search: `?token=${token}`,
        });
        const verifyFn = jest.fn(() => ({
          data: {
            verifyProjectInvite: {
              claims,
              existingAccount: true,
            },
          },
        }));
        const confirmFn = jest.fn(() => ({
          data: {
            confirmProjectInvite: {
              projectSlug: "test",
            },
          },
        }));
        const loginWithRedirect = jest.fn();
        const logout = jest.fn();

        // @ts-ignore
        useAuth0.mockReturnValue({
          isAuthenticated: true,
          user: {
            email: "chad@example.com",
          },
          logout,
          loginWithRedirect: loginWithRedirect,
        });
        render(
          <Router history={history}>
            <MockedProvider
              mocks={[
                {
                  request: {
                    query: VerifyProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: verifyFn,
                },
                {
                  request: {
                    query: ConfirmProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: confirmFn,
                },
              ]}
            >
              <Landing />
            </MockedProvider>
          </Router>
        );
        await waitFor(() => {
          expect(verifyFn).toBeCalledTimes(1);
        });
        fireEvent.click(screen.getByText(/accept/i));
        await waitFor(() => {
          // Invite should be confirmed
          expect(confirmFn).toBeCalledTimes(1);
        });
        // App should be redirected to project
        expect(history.location.pathname).toBe("/test/join");
      });
      test("Accepting as another user logs out current session and redirects to confirmation page after authentication", async () => {
        const history = createMemoryHistory();
        const claims: ProjectInviteTokenClaims = {
          email: "test@example.com",
          projectName: "Test Project",
          projectSlug: "test",
          admin: false,
          inviteId: 1,
          wasUsed: false,
          projectId: 1,
        };
        const token = jwt.sign(claims, "secret", {
          expiresIn: "1 day",
        });
        history.push({
          pathname: "/auth/projectInvite",
          search: `?token=${token}`,
        });
        const verifyFn = jest.fn(() => ({
          data: {
            verifyProjectInvite: {
              claims,
              existingAccount: true,
            },
          },
        }));
        const confirmFn = jest.fn(() => ({
          data: {
            confirmProjectInvite: {
              projectSlug: "test",
            },
          },
        }));
        const loginWithRedirect = jest.fn();
        const logout = jest.fn();

        // @ts-ignore
        useAuth0.mockReturnValue({
          isAuthenticated: true,
          user: {
            email: "chad@example.com",
          },
          logout,
          loginWithRedirect: loginWithRedirect,
        });
        render(
          <Router history={history}>
            <MockedProvider
              mocks={[
                {
                  request: {
                    query: VerifyProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: verifyFn,
                },
                {
                  request: {
                    query: ConfirmProjectInviteDocument,
                    variables: {
                      token,
                    },
                  },
                  result: confirmFn,
                },
              ]}
            >
              <Landing />
            </MockedProvider>
          </Router>
        );
        await waitFor(() => {
          expect(verifyFn).toBeCalledTimes(1);
        });
        fireEvent.click(screen.getByText(/sign in as/i));
        await waitFor(() => {
          // Invite should be confirmed
          expect(loginWithRedirect).toBeCalledTimes(1);
          expect(loginWithRedirect).toBeCalledWith(
            expect.objectContaining({
              authorizationParams: expect.objectContaining({
                max_age: 0,
                redirect_uri: `http://localhost/auth/projectInvite/confirm?token=${token}`,
              }),
            })
          );
        });
      });
    });
  });

  describe("Confirmation page", () => {
    test("Confirms invite and redirects to project homepage", async () => {
      const history = createMemoryHistory();
      const claims: ProjectInviteTokenClaims = {
        email: "test@example.com",
        projectName: "Test Project",
        projectSlug: "test",
        admin: false,
        inviteId: 1,
        wasUsed: false,
        projectId: 1,
      };
      const token = jwt.sign(claims, "secret", {
        expiresIn: "1 day",
      });
      history.push({
        pathname: "/auth/projectInvite/confirm",
        search: `?token=${token}`,
      });
      const verifyFn = jest.fn(() => ({
        data: {
          verifyProjectInvite: {
            claims,
            existingAccount: true,
          },
        },
      }));
      const confirmFn = jest.fn(() => ({
        data: {
          confirmProjectInvite: {
            projectSlug: "test",
          },
        },
      }));
      const loginWithRedirect = jest.fn();
      const logout = jest.fn();

      // @ts-ignore
      useAuth0.mockReturnValue({
        isAuthenticated: true,
        user: {
          email: "chad@example.com",
        },
        logout,
        loginWithRedirect: loginWithRedirect,
      });
      render(
        <Router history={history}>
          <MockedProvider
            mocks={[
              {
                request: {
                  query: VerifyProjectInviteDocument,
                  variables: {
                    token,
                  },
                },
                result: verifyFn,
              },
              {
                request: {
                  query: ConfirmProjectInviteDocument,
                  variables: {
                    token,
                  },
                },
                result: confirmFn,
              },
            ]}
          >
            <Landing />
          </MockedProvider>
        </Router>
      );
      await waitFor(() => {
        expect(verifyFn).toBeCalledTimes(1);
        expect(confirmFn).toBeCalledTimes(1);
      });
      expect(history.location.pathname).toBe("/test/join");
    });
  });

  test.todo(
    "email should be confirmed after accepting project invite (w/same email)"
  );
  test.todo(
    "email should *not* be confirmed if accepting an invite to a different email"
  );
});
