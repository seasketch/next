/* eslint-disable i18next/no-literal-string */
import { DocumentNode } from "graphql";
import { gql } from "@apollo/client";
import { request } from "graphql-request";
import { ProjectAccessControlSetting } from "../../src/generated/graphql";

const jwt = require("jsonwebtoken");
const users = require("../fixtures/users.json");

const AUTH0_CLIENT_ID = Cypress.env("auth0_client_id");
const AUTH0_CLIENT_SECRET = Cypress.env("auth0_client_secret");
const AUTH0_AUDIENCE = Cypress.env("auth0_audience");
const AUTH0_SCOPE = Cypress.env("auth0_scope");
const AUTH0_DOMAIN = Cypress.env("auth0_domain");

const loginCounts = {};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login the named user. Users are found in fixtures/user.json
       * @example cy.login('User 1')
       */
      login(userName: string);
      getToken(
        userName: string
      ): Chainable<{
        id_token: string;
        access_token: string;
        scope: string;
        token_type: "Bearer";
      }>;
      query(doc: DocumentNode, data: any, token?: string): Chainable<any>;
      mutation(doc: DocumentNode, data: any, token?: string): Chainable<any>;
      createProject(
        name: string,
        slug: string,
        accessControl: ProjectAccessControlSetting,
        isListed: boolean
      ): Chainable<number>;
      deleteProject(slug: string);
    }
  }
}

Cypress.Commands.add("login", (userName) => {
  return cy.getToken(userName).then((body) => {
    const token = body.id_token;
    const claims = jwt.decode(token);
    const {
      nickname,
      name,
      picture,
      updated_at,
      email,
      email_verified,
      sub,
      exp,
    } = claims;

    const item = {
      body: {
        ...body,
        decodedToken: {
          claims,
          user: {
            nickname,
            name,
            picture,
            updated_at,
            email,
            email_verified,
            sub,
          },
          audience: AUTH0_AUDIENCE,
          client_id: AUTH0_CLIENT_ID,
        },
      },
      expiresAt: exp,
    };
    window.localStorage.setItem(
      // The client sets up a connection using @auth/auth0-react
      // This ID used to store the data in localstorage is determined by it
      `@@auth0spajs@@::${AUTH0_CLIENT_ID}::default::${AUTH0_SCOPE}`,
      JSON.stringify(item)
    );

    cy.visit("/");
  });
});

Cypress.Commands.add("getToken", (userName) => {
  const user = users[userName];
  if (!user) {
    throw new Error(`Unrecognized user "${userName}"`);
  }
  if (!loginCounts[userName]) {
    loginCounts[userName] = 0;
  }
  loginCounts[userName] += 1;

  if (loginCounts > 20) {
    throw new Error(`Reached auth0 rate limit`);
    // TODO: Implement guidance on resetting rate limits once this count is hit
    // https://docs.cypress.io/guides/testing-strategies/auth0-authentication#Auth0-Rate-Limiting-Logins
    // We probably ought to reset every 5 runs or so to account for parallelized runs later
    // ...do the reset, then
    loginCounts[userName] = 0;
  }
  return cy
    .request({
      log: false,
      method: "POST",
      url: `https://${AUTH0_DOMAIN}/oauth/token`,
      body: {
        grant_type: "password",
        username: user.email,
        password: user.password,
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE,
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
      },
    })
    .then((response) => {
      return response.body as {
        id_token: string;
        access_token: string;
        scope: string;
        token_type: "Bearer";
      };
    });
});

Cypress.Commands.add(
  "query",
  (doc: DocumentNode, data: any, token?: string) => {
    const doQuery = async (headers: any) => {
      return request(
        Cypress.env("graphql_endpoint") as string,
        doc,
        data,
        headers
      );
    };
    return cy.location().then((location) => {
      return doQuery({
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "x-ss-slug": location.pathname.split("/")[1],
      });
    });
  }
);

Cypress.Commands.add(
  "mutation",
  (doc: DocumentNode, data: any, token?: string) => {
    const doQuery = async (headers: any) => {
      return request(
        Cypress.env("graphql_endpoint") as string,
        doc,
        data,
        headers
      );
    };
    return cy.location().then((location) => {
      return doQuery({
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "x-ss-slug": location.pathname.split("/")[1],
      });
    });
  }
);

Cypress.Commands.add(
  "createProject",
  (
    name: string,
    slug: string,
    accessControl: ProjectAccessControlSetting,
    isListed: boolean
  ) => {
    return cy.get("@token").then((token) => {
      if (!token) {
        throw new Error(
          "No token set. Use cy.wrap(token.access_token).as('token') to set a project owner."
        );
      }
      return cy
        .mutation(
          gql`
            mutation CypressCreateProject($name: String!, $slug: String!) {
              createProject(input: { name: $name, slug: $slug }) {
                project {
                  id
                  accessControl
                }
              }
            }
          `,
          { name, slug },
          (token as unknown) as string
        )
        .then((data) => {
          Cypress.log(data);
          if (accessControl !== ProjectAccessControlSetting.AdminsOnly) {
            return cy
              .mutation(
                gql`
                  mutation CypressSetAccessControl(
                    $id: Int!
                    $accessControl: ProjectAccessControlSetting!
                    $isListed: Boolean
                  ) {
                    updateProject(
                      input: {
                        id: $id
                        patch: {
                          accessControl: $accessControl
                          isListed: $isListed
                        }
                      }
                    ) {
                      project {
                        id
                      }
                    }
                  }
                `,
                {
                  accessControl,
                  id: data.createProject.project.id,
                  isListed: isListed,
                },
                (token as unknown) as string
              )
              .then(() => data.createProject.project.id);
          } else {
            return data.createProject.project.id;
          }
        });
    });
  }
);

Cypress.Commands.add("deleteProject", (slug: string) => {
  cy.exec(`cypress/support/deleteProject.js ${slug}`).then((out) => {
    cy.log(out.stdout);
  });
});