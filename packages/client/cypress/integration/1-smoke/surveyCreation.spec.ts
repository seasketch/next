//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { ProjectAccessControlSetting } from "../../../src/generated/graphql";


let surveyId: any
let authToken: any
let formId: any


function generateSlug() { 
  const result = Math.random().toString(36).substring(2,7);
  return result
}

const slug = generateSlug()

describe("Survey creation smoke test", () => {
  describe ('Survey creation Cypress commands', () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName == "CypressCreateProject")) {
          req.alias = "createProjectRequest"
        } else if ((req.body.operationName) && (req.body.operationName == "CypressCreateSurvey")) {
          req.alias = "createSurveyRequest"
        }
      })
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          `Maldives Spatial Planning Test - ${slug}`,
          slug,
          ProjectAccessControlSetting.Public,
          true
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId").then(() => {
            cy.createSurvey(
              `Maldives Ocean Use Survey Test - ${slug}`, 
              projectId, 
              access_token
            ).then((resp) => {
              cy.wrap(resp.makeSurvey.survey.form.id).as('formId')
              cy.wrap(resp.makeSurvey.survey.form.formElements).as('formElements')
              cy.wrap(resp.makeSurvey.survey.id).as('surveyId')
            })
          });
        });
      });
    })
    afterEach(() => {
      cy.deleteProject(`${slug}`)
    })
    it ("Creates the project", () => {
      cy.wait('@createProjectRequest')
        .its('response.body.data.createProject.project')
        .should('have.property', 'id')
      //cy.contains("Maldives Spatial Planning Test")
    })
    it ("Creates the survey", () => {
      cy.wait("@createSurveyRequest")
        .its('response.body.data.makeSurvey.survey')
        .should('have.property', 'id')
    })
    it ("Updates the survey's isDisabled field", () => {
      cy.get("@surveyId").then((id) => {
        surveyId = id
        cy.get('@token').then((token) => {
          authToken = token
          cy.updateSurvey(surveyId, authToken).then((resp) => {
            expect (resp.updateSurvey.survey.isDisabled).to.equal(false)
            expect (resp.updateSurvey.survey.accessType).to.equal('PUBLIC')
          })
        })
      })
    })
    it ("Can delete default form elements not required by survey", () => {
     cy.get('@formId').then((id) => {
       formId = id
        cy.get('@token').then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken).then((resp) => {
            console.log(resp)
            expect (resp.deleteFormElement.query.form.formElements.length).to.be.lt(5)
          })
        })
      })
    })
    it ("Can update form with form elements", () => {
      cy.get('@formId').then((id) => {
        formId = id 
        cy.get("@token").then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken)
          cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
            expect (resp.createFormElement.query.form.formElements.length).to.be.gt(3)
          })
        })
      })
    })
  })
  describe.only ('User survey flow', () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName == "CypressCreateProject")) {
          req.alias = "createProjectRequest"
        } else if ((req.body.operationName) && (req.body.operationName == "CypressCreateSurvey")) {
          req.alias = "createSurveyRequest"
        }
      })
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          `Maldives Spatial Planning Test - ${slug}`,
          slug,
          ProjectAccessControlSetting.Public,
          true
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId").then(() => {
            cy.createSurvey(
              `Maldives Ocean Use Survey Test - ${slug}`, 
              projectId, 
              access_token
            ).then((resp) => {
              cy.wrap(resp.makeSurvey.survey.form.id).as('formId')
              cy.wrap(resp.makeSurvey.survey.form.formElements).as('formElements')
              cy.wrap(resp.makeSurvey.survey.id).as('surveyId')
              cy.updateSurvey(resp.makeSurvey.survey.id, access_token).then((resp) => {
                console.log(resp)
              })
            })
          });
        });
      });
    })
    afterEach(() => {
      cy.get('@surveyId').then((id) => {
        surveyId = id
        cy.get('@token').then((token) => {
          authToken = token
          cy.deleteSurvey(surveyId, authToken).then(() => {
          })
        })
      })
      cy.deleteProject(`${slug}`) 
    })

    it("Can visit the survey", () => {
      cy.get('@formElements').then((el) => {
        console.log(el)
        console.log(el.length)
      })
      cy.get('@formId').then((id) => {
        formId = id 
        cy.get("@token").then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken)
          //args are formId, formElements fixture alias, token
          cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
            console.log(resp)
          })
          //  expect (resp.createFormElement.query.form.formElements.length).to.equal(40)
          //})
        })
      })
      cy.get("@surveyId").then((id) => {
        cy.visit(`${slug}/surveys/${id}`)
        cy.contains('Begin', {timeout: 30000})
        //cy.contains("Skip Question").click()
        //cy.contains("Skip Question").click()
      })
    })
  })
})


//Refactor
//Consolidate
//Move command tests to command tests folder
//Conditional checks
//Before vs beforeEach; after vs afterEach




//Logged in vs anon
///A user can visit homepage
//A user can sign in
//A user can create a project
//A user can visit project admin
//A user can visit surveys page
//A user can create a survey
//A user can visit survey admin page
//A user can modify survey
//A user can take survey and data is saved appropriately
//Test on mobile
