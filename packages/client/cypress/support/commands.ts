/* eslint-disable i18next/no-literal-string */
import { DocumentNode } from "graphql";
import { gql } from "@apollo/client";
import { request } from "graphql-request";
import { ProjectAccessControlSetting } from "../../src/generated/graphql";
import { data } from "cypress/types/jquery";
import "cypress-localstorage-commands"

const jwt = require("jsonwebtoken");
const users = require("../fixtures/users.json");
const formElements = require("../fixtures/formElements.json")

const AUTH0_CLIENT_ID = Cypress.env("auth0_client_id");
const AUTH0_CLIENT_SECRET = Cypress.env("auth0_client_secret");
const AUTH0_AUDIENCE = Cypress.env("auth0_audience");
const AUTH0_SCOPE = Cypress.env("auth0_scope");
const AUTH0_DOMAIN = Cypress.env("auth0_domain");

const loginCounts = {};

interface FixtureForm {
  data: object,
  form: object,
  formElements: object

}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Sign in to SeaSketch using auth0 token service
       * @param userName Named user from fixtures/user.json
       * @example cy.login('User 1')
       */
      login(userName: string);
      /**
       * Get token from auth0
       * @param userName Named user from fixtures/user.json
       */
      getToken(
        userName: string
      ): Chainable<{
        id_token: string;
        access_token: string;
        scope: string;
        token_type: "Bearer";
      }>;
      /**
       * Run a graphql query.
       * @param doc DocumentNode created using gql (@apollo/client)
       * @param data Data to apply to the query
       * @param token access_token for a user to run the query under
       */
      query(doc: DocumentNode, data: any, token?: string): Chainable<any>;
      /**
       * Run a graphql mutation. (same as cy.query)
       * @param doc DocumentNode created using gql (@apollo/client)
       * @param data Data to apply to the mutation
       * @param token access_token for a user to run the mutation under
       */
      mutation(doc: DocumentNode, data: any, token?: string): Chainable<any>;
      /**
       * Create a new SeaSketch project. Project must be created by a named
       * user. Set a token using the following code:
       *   ```typescript
       *   cy.getToken("User 1").then(({ access_token }) => {
       *     cy.wrap(access_token).as("token");
       *   });
       *   ```
       * @param name Name for the project
       * @param slug Slug is appended to the url, e.g. seasketch.org/:slug
       * @param accessControl ProjectAccessControlSetting. Public, AdminsOnly or InviteOnly
       * @param isListed Whether to publically list the project on the homepage. Public projects must be listed
       */
      createProject(
        name: string,
        slug: string,
        accessControl: ProjectAccessControlSetting,
        isListed: boolean
      ): Chainable<number>;
      /**
       * Permanently deletes the project from the database, by slug. Note that
       * this operation happens directly in the db, rather than through the
       * graphql api. The GraphQL API does not support deleting projects
       * entirely, but rather marks them as deleted so that their slug can't be
       * re-used. For testing purproses, these need to be permanently deleted.
       * @param slug
       */
      deleteProject(slug: string);

      createSurvey(
        name: string, 
        projectId: number,
        token: string
      )//: Chainable <number>;

      deleteSurvey(
        surveyId: number,
        token: string
      )

      updateSurvey(
        surveyId: number,
        token: string
      )

      getSurvey(
        surveyId: number
      )

      createFormElements(
        formId: number,
        surveyAlias: string,
        token: string
      )

      deleteFormElements(
        formId: number,
        token: string
      )
      
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
    window.localStorage.setItem(
      // The client sets up a connection using @auth/auth0-react
      // This ID used to store the data in localstorage is determined by it
      `@@auth0spajs@@::${AUTH0_CLIENT_ID}::${AUTH0_AUDIENCE}::${AUTH0_SCOPE}`,
      JSON.stringify(item)
    );
    cy.log(`Logged in ${userName}`);
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
    return cy.query(doc, data, token);
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
  cy.exec(`cypress/support/deleteProject.js ${slug}`, {failOnNonZeroExit: false}).then((out) => {
    cy.log(out.stdout);
  });
});

Cypress.Commands.add("createSurvey", (name: string, projectId: number, token: string) => {
  if (!token) {
    throw new Error(
      "No token set. Use cy.wrap(token.access_token).as('token') to set a project owner."
    );
  }
  return cy
  .mutation(
    gql`
      mutation CypressCreateSurvey($name: String!, $projectId: Int!) {
        makeSurvey(input: { name: $name, projectId: $projectId }) {
          survey {
            id,
            name,
            form {
              id, 
              templateType, 
              formElements {
                id,
                type {
                  componentName
                }
                body,
                typeId
              }
            }
          }
        }
      }
    `,
  { name, projectId },
  (token as any)
)
.then((data) => {
  Cypress.log(data);
  return data
  })
})
 
Cypress.Commands.add("deleteSurvey", (surveyId, token) => {
  const deleteSurvey = 
    `
      mutation deleteSurvey {
          deleteSurvey (input: { id: ${surveyId} }) {
            survey {
              id
            }
          }  
      }
    `;
    cy.request({
        log: true,
        url: 'http://localhost:3857/graphql',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: {
            query: deleteSurvey
        },
        failOnStatusCode: false
      })
      cy.log(`Deleted survey with id of ${surveyId}.`)
  });

  Cypress.Commands.add("updateSurvey", (surveyId: number, token: string) => {
    if (!token) {
      throw new Error(
        "No token set. Use cy.wrap(token.access_token).as('token') to set a project owner."
      );
    }
    return cy
      .mutation(
        gql`
          mutation CypressUpdateSurvey($surveyId: Int!) {
            updateSurvey(input: { 
              id: $surveyId 
              patch: {
                isDisabled: false, 
                accessType: PUBLIC
              }
            }) 
            {
              survey {
                id,
                isDisabled,
                accessType, 
                project {
                  slug
                }
              }
            }
          }
        `,
      { surveyId },
      (token as any)
    )
    .then((data) => {
      Cypress.log(data);
      return data
    })
  })

  Cypress.Commands.add("deleteFormElements", (formId: number, token: string) => {
    if (!formId) {
      throw new Error("Please check your form id.");
    } else if (!token) {
      throw new Error("Please check your token.");
    }
    else {
      return cy
      .query(
        gql`
          query CypressGetForm($formId: Int!) {
            form (id: $formId) {
              formElements {
                id, 
                typeId,
                type { 
                  isRequiredForSurveys
                }
              }
            }
          }
        `,
      { formId },
      (token as any)
      )
      .then((data) => {
        if (!data || !data.form.formElements) {
          throw new Error ("No form elements found.")
        }
        else {
          const elementsToDelete = data.form.formElements.filter(obj => {
            return obj.type.isRequiredForSurveys === false
          })
            elementsToDelete.forEach((formElement) => {
            return cy
              .mutation(
                gql`
                  mutation CypressDeleteFormElements($formElementId: Int!) {
                    deleteFormElement (input: {id: $formElementId}) {
                      query {
                        form (id: ${formId}) {
                          formElements {
                            id
                          }
                        }
                      }
                    }
                  }
                `,
              { formElementId: formElement.id },
              (token as any)
            ).then((data) => {
              Cypress.log(data);
              return data
            })
          })
        }
      })
    }
  })

  Cypress.Commands.add("createFormElements", (formId: number, surveyAlias: string, token: string) => {
    const elements = formElements[surveyAlias].data.form.formElements
    //console.log(elements.length)
    //Object.keys(elements).forEach((e) => {
    //  Object.keys(e).forEach((f) => {
    //    console.log(f)
    //  })
    //})
    elements.map(t => t.formId = formId)
    if (!surveyAlias) {
      throw new Error(`Unrecognized alias "${surveyAlias}"`);
    }
    else {
      elements.forEach((e) => {
          return cy
          .mutation(
            gql`
              mutation CypressCreateFormElement($formElement: FormElementInput!) {
                createFormElement(input: {formElement: $formElement} )
                {
                  formElement {
                    formId, 
                    body
                  }
                  query {
                    form (id: ${formId}) {
                      formElements {
                        typeId, 
                        id, 
                        body
                      }
                    }
                  }

                }
              }
            `,
            { "formElement": {
              "formId": e.formId,
              "isRequired": e.isRequired,
              "exportId": e.exportId,
              "position": e.position,
              "componentSettings": e.componentSettings,
              "typeId": e.typeId,
              "body": e.body,
              "backgroundColor": e.backgroundColor,
              "secondaryColor": e.secondaryColor,
              "textVariant": e.textVariant,
              "layout": e.layout,
              "backgroundPalette": e.backgroundPalette,
              "jumpToId": e.jumpToId,
              "alternateLanguageSettings": e.alternateLanguageSettings,
              "subordinateTo": e.subordinateTo
            } },
          (token as any)
          )
          .then((data) => {
            Cypress.log(data);
            return data
          })
        })
      }
    })
 

//TO DO:
//add rest of form attributes
//delete default formElements
//Create form first and then attach to survey?
//Add consent file before or???
//Scaffold plan for tests; organize
