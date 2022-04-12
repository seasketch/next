/* eslint-disable i18next/no-literal-string */
import { DocumentNode } from "graphql";
import { gql } from "@apollo/client";
import { request } from "graphql-request";
import { ProjectAccessControlSetting } from "../../src/generated/graphql";
import { data } from "cypress/types/jquery";
import "cypress-localstorage-commands"

const jwt = require("jsonwebtoken");
const users = require("../fixtures/users.json");
const formElements = require("../fixtures/formElements.json");
const SAPElements = require("../fixtures/SAPElements.json");
const formLogicRules = require("../fixtures/formLogicRules.json");
const componentSettings =  require("../fixtures/SAPComponentSettings.json");


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
      );

      getSurvey(
        surveyId: number
      );

      updateSurvey(
        surveyId: number,
        token: string
      );

      deleteSurvey(
        surveyId: number,
        token: string
      );

      deleteForm(
        formId: number, 
        token: string
      );

      createFormElements(
        formId: number,
        surveyAlias: string,
        token: string
      );

      createSAPElements(
        formId: number, 
        surveyAlias: string,
        token: string
      );

      updateComponentSettings(
        sapElementId: number, 
        referenceElements: object, 
        token: string, 
        formId: number
      );

      updateSubordinateToId(
        subordinateToId: number, 
        elementsToUpdate: any, 
        formId: number, 
        token: string
      );

      updateJumpToId(
        jumptToIds: object,
        elementsToUpdate: any, 
        formId: number,
        token: string
      );

      updateFormElements(
        elementIds: object,
        fixtureAlias: string,
        token: string, 
        formId: number
      );

      deleteFormElements(
        formId: number,
        token: string
      );

      createFormLogicRules(
        formId: number,
        fixtureAlias: string,
        newIds: object, 
        token: string
      );

      createLastFormLogicRules(
        formId: number,
        fixtureAlias: string,
        newIds: object, 
        token: string
      );

      getSurveyResponse(
        responseId: number, 
        token: string
      );

      deleteSketch(
        sketchId: number, 
        token:string
      );

      getFormElements(
        formId: number
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
            project {
              slug
            }
            form {
              id, 
              templateType, 
              formElements {
                id,
                type {
                  componentName, 
                  isRequiredForSurveys
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
  ).then((data) => {
    Cypress.log(data);
    return data
  })
})

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
              accessType: PUBLIC, 
              supportedLanguages: "dv"
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
 
Cypress.Commands.add("deleteSurvey", (surveyId: number, token: string) => {
  if (!surveyId) {
    throw new Error("Please check your survey id.");
  }
  else {
    return cy
      .mutation(
        gql`
          mutation CypressDeleteSurvey($surveyId: Int!) {
            deleteSurvey (input: {id: $surveyId}) {
              survey {
                id
              }
            }
          }
        `,
      { surveyId }, 
      (token as any)
    ).then((data) => {
      Cypress.log(data);
      return data
    })
  }
})

Cypress.Commands.add("deleteForm", (formId: number, token: string) => {
  if (!formId) {
    throw new Error("Please check your form id.");
  }
  else {
    return cy
      .mutation(
        gql`
          mutation CypressDeleteForm($formId: Int!) {
            deleteForm (input: {id: $formId}) {
              form {
                id
                survey {
                  project {
                    slug
                  }
                }
              }
            }
          }
        `,
      { formId }, 
      (token as any)
    ).then((data) => {
      Cypress.log(data);
      return data
    })
  }
})

Cypress.Commands.add("createFormElements", (formId: number, fixtureAlias: string, token: string) => {
  const elements = formElements[fixtureAlias].data.form.formElements
  elements.map(t => t.formId = formId)
  if (!fixtureAlias) {
    throw new Error(`Unrecognized alias "${fixtureAlias}"`);
  }
  else {
    elements.forEach((e) => {
      if (e.typeId !== "WelcomeMessage" && e.typeId !== "ThankYou" && e.typeId !== "SaveScreen") {
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
                    logicRules {
                      formElementId,
                      booleanOperator,
                      command
                    }
                    formElements {
                      typeId, 
                      id, 
                      body, 
                      subordinateTo
                    }
                    survey {
                      project {
                        id,
                        slug
                      }
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
            "alternateLanguageSettings": e.alternateLanguageSettings,
            //"subordinateTo": e.subordinateTo
            }
          },
        (token as any)
        ).then((data) => {
          Cypress.log(data)
          return data
        })
      }
    })
  }
})

Cypress.Commands.add("createSAPElements", (formId: number, fixtureAlias: string, token: string) => {
  const elements = SAPElements[fixtureAlias].data.form.formElements
  elements.map(t => t.formId = formId)
  if (!fixtureAlias) {
    throw new Error(`Unrecognized alias "${fixtureAlias}"`);
  }
  else {
    elements.forEach((e) => {
      if (e.typeId !== "FeatureName" && e.typeId !== "SAPRange") {
        return cy
        .mutation(
          gql`
            mutation CypressCreateSAPElement($formElement: FormElementInput!) {
              createFormElement(input: {formElement: $formElement} )
              {
                formElement {
                  formId, 
                  body
                }
                query {
                  form (id: ${formId}) {
                    logicRules {
                      formElementId,
                      booleanOperator,
                      command
                    }
                    formElements {
                      typeId, 
                      id, 
                      body, 
                      exportId
                    }
                    survey {
                      project {
                        id,
                        slug
                      }
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
            "alternateLanguageSettings": e.alternateLanguageSettings,
            //"subordinateTo": e.subordinateTo
            }
          },
        (token as any)
        ).then((data) => {
          Cypress.log(data)
          return data
        })
      }
    })
  }
})

Cypress.Commands.add("updateSubordinateToId", (subordinateToId: number, elementsToUpdate: any, formId: number, token: string) => {
  elementsToUpdate.map(t => t.subordinateTo = subordinateToId)
  elementsToUpdate.forEach((f) => {
      return cy
        .mutation(
          gql`
            mutation CypressUpdateSubordinateToId($input: UpdateFormElementInput!) {
            updateFormElement(input: $input) {
              formElement {
                id,
                typeId,
                subordinateTo
              } 
               query {
                form (id: ${formId}) {
                  id,
                  formElements {
                    id,
                    typeId,
                    subordinateTo
                  }
                }
              }
            }
          }
        `,
      { 
      "input": {
        "id": f.id,
        "patch": {
          "subordinateTo": f.subordinateTo
        }
      }
     },
    (token as any)
    ).then((data) => {
      Cypress.log(data)
      return data
    })
  })
})
  
Cypress.Commands.add("updateJumpToId", (jumpToIds: object, elementsToUpdate: any, formId: number, token: string) => {
  elementsToUpdate.map(t => {
    if(t.typeId !== "YesNo") {
      t.jumpToId = jumpToIds[1]
    }
    else {
      t.jumpToId = jumpToIds[0]
    }
  })
  elementsToUpdate.forEach((f) => {
      return cy
        .mutation(
          gql`
            mutation CypressUpdateJumpToId($input: UpdateFormElementInput!) {
            updateFormElement(input: $input) {
              formElement {
                id,
                typeId,
                jumpToId
              } 
               query {
                form (id: ${formId}) {
                  id,
                  formElements {
                    id,
                    typeId,
                    jumpToId
                  }
                }
              }
            }
          }
        `,
      { 
      "input": {
        "id": f.id,
        "patch": {
          "jumpToId": f.jumpToId
        }
      }
     },
    (token as any)
        ).then((data) => {
          Cypress.log(data)
          return data
        })
    })
})

Cypress.Commands.add("updateComponentSettings", (sapId: number, referenceElements: any, token: string, formId: number) => {
  const childVisSettings = componentSettings["Maldives"].data.formElement.componentSettings.childVisibilitySettings
  const subordinateSettings =  componentSettings["Maldives"].data.formElement.componentSettings.subordinateVisibilitySettings
  const baseSettings =  componentSettings["Maldives"].data.formElement.componentSettings
  const createNewSettingsObj = (settings, settingsKey) => {
   let objToAdd = {}
   Object.keys(settings).map((key) => {
    if (referenceElements[key]) {
      objToAdd[referenceElements[key]] = settings[key]
    }
  })
   delete baseSettings[settingsKey]
   baseSettings[settingsKey] = objToAdd
  }
  createNewSettingsObj(childVisSettings, 'childVisibilitySettings')
  createNewSettingsObj(subordinateSettings, 'subordinateVisibilitySettings')
  return cy
    .mutation(
      gql`
        mutation CypressUpdateComponentSettings($input: UpdateFormElementInput!) {
          updateFormElement(input: $input) {
          formElement {
            id
            componentSettings
          }
            query {
              form (id: ${formId}) {
                id,
                formElements {
                  id,
                  typeId,
                  body, 
                  componentSettings
                }
              }
            }
          }
        }
      `,
    { 
      "input": {
        "id": sapId,
        "patch": {
          "componentSettings": baseSettings
        }
      }
     },
    (token as any)
  )
  .then((data) => {
    Cypress.log(data);
    return data
  })
})

Cypress.Commands.add("updateFormElements", (elementsToUpdate: object, fixtureAlias: string, token: string, formId: number) => {
  //elementIds are ids of form elements created at form inception that are required by survey. These need to be updated.
  //initialize newElements array to store matching form elements from fixture
  const newElements = []
  const elements = formElements[fixtureAlias].data.form.formElements

  //iterate over fixture to get form elements matching elements that need to be updated
  elements.forEach((t) => {
    if (t.typeId === "WelcomeMessage") {
      newElements.push(t)
    } else if (t.typeId === "ThankYou") {
      newElements.push(t)
    } else if (t.typeId === "SaveScreen") {
      newElements.push(t)
    }
  })
  
  //replace form element ids from fixture survey with form element ids from test survey
  newElements[0].id = elementsToUpdate[0].id
  newElements[1].id = elementsToUpdate[2].id
  newElements[2].id = elementsToUpdate[1].id

  //iterate over elements with corrected ids and update form
  newElements.forEach((f) => {
    return cy
    .mutation(
      gql`
        mutation CypressUpdateFormElements($input: UpdateFormElementInput!) {
          updateFormElement(input: $input) {
            formElement {
              id
              typeId
              body
            } 
            query {
              form (id: ${formId}) {
                id,
                formElements {
                  id,
                  typeId,
                  body
                }
              }
            }
          }
        }
      `,
    { 
      "input": {
        "id": f.id,
        "patch": {
          "body": f.body,
          "position": f.position,
          "exportId": f.exportId,
          "componentSettings": f.componentSettings,
          "backgroundColor": f.backgroundColor,
          "secondaryColor": f.secondaryColor,
          "textVariant": f.textVariant,
          "layout": f.layout,
          "backgroundPalette": f.backgroundPalette,
          "backgroundWidth": f.backgroundWidth,
          "backgroundHeight": f.backgroundHeight,
          "jumpToId": f.jumpToId,
          "alternateLanguageSettings": f.alternateLanguageSettings,
          "subordinateTo": f.subordinateTo
        }
      }
     },
    (token as any)
  )
  .then((data) => {
    Cypress.log(data);
    return data
  })

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
                          id,
                          typeId,
                          body
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

Cypress.Commands.add("createFormLogicRules", (formId: number, fixtureAlias: string, newIds: object, token: string) => {
  const formLogic = formLogicRules[fixtureAlias].data.form.logicRules
  let formLogicCopy = JSON.parse(JSON.stringify(formLogic));
  for (let i=0; i< formLogicCopy.length; i++) {
    formLogicCopy[i].jumpToId = newIds[i+1]
  }
  formLogicCopy.map(t => {
    if (t.formElementId === 74 && t.conditions[0].subjectId === 74) {
      t.formElementId = t.conditions[0].subjectId = newIds[0]
    } else if (t.formElementId === 98 && t.conditions[0].subjectId === 98) {
      t.formElementId = t.conditions[0].subjectId = newIds[20]
      t.jumpToId = newIds[21]
    } else if (t.formElementId === 99 && t.conditions[0].subjectId === 99) {
      t.formElementId = t.conditions[0].subjectId = newIds[21]
      t.jumpToId = newIds[21] + 1
    }
  })
  formLogicCopy.forEach((f) => {
    return cy
      .mutation(
        gql`
          mutation CypressCreateFormLogicRule($formLogicRule: FormLogicRuleInput!) {
            createFormLogicRule(input: {formLogicRule: $formLogicRule} )
            {
              formLogicRule {
                id 
                booleanOperator
                command
                jumpToId
                formElementId
                position
              }
              query {
                form (id: ${formId}) {
                  formElements {
                    jumpToId
                  }
                  logicRules {
                    formElementId,
                    booleanOperator,
                    jumpToId,
                    command,
                    position
                  }
                }
              }
            }
          }
        `,
        { "formLogicRule": {
            "formElementId": f.formElementId,
            "booleanOperator": f.booleanOperator,
            "command": f.command,
            "jumpToId": f.jumpToId,
            "position": f.position
          }
        },
      (token as any),
    ).then((data) => {
      Cypress.log(data)
      if (data) {
        return cy
          .mutation(
            gql`
              mutation CypressCreateFormLogicCondition($formLogicCondition:  FormLogicConditionInput!) {
                createFormLogicCondition(input: {formLogicCondition: $formLogicCondition} )
                {
                  formLogicCondition {
                    id
                  }
                  query {
                    form (id: ${formId}) {
                    id
                    formElements {
                      id, 
                      jumpToId, 
                      typeId, 
                      body, 
                      exportId
                    }
                      logicRules {
                        formElementId,
                        booleanOperator,
                        jumpToId,
                        command,
                        position, 
                        conditions {
                          ruleId, 
                          subjectId, 
                          operator, 
                          value
                        }
                      }
                    }
                  }
                }
              }
            `,
            { "formLogicCondition": {
                "ruleId": data.createFormLogicRule.formLogicRule.id,
                "subjectId": f.conditions[0].subjectId,
                "operator": f.conditions[0].operator,
                "value": f.conditions[0].value
              }
            },
          (token as any),
          ).then((data) => {
            Cypress.log(data)
            return data
          })
        }
      })
    })
  })

  Cypress.Commands.add("getSurveyResponse", (surveyResponseId: number, token: string) => {
    return cy
    .query(
      gql`
        query CypressGetSurveyResponse($surveyResponseId: Int!) {
          query {
            surveyResponse(id: $surveyResponseId) {
              id, 
              surveyId, 
              data
            }
          
          }
        }
      `,
     {
      "surveyResponseId": surveyResponseId
      },
      (token as any)
    ).then((data) => {
      Cypress.log(data)
    })
  })

  Cypress.Commands.add("deleteSketch", (sketchId: number, token:string) => {
    return cy
      .mutation(
        gql`
          mutation CypressDeleteSketch($sketchId: Int!) {
            deleteSketch (input: {id: $sketchId}) {
              sketch {
                id
              }
            }
          }
        `,
      { sketchId: sketchId },
      (token as any)
    ).then((data) => {
      Cypress.log(data)
    })
  })

  Cypress.Commands.add('getFormElements', (formId: number) => {
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
    ).then((data) => {
      Cypress.log(data)
    })
  })