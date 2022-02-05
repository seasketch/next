//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { ProjectAccessControlSetting, useCreateSurveyMutation } from "../../../src/generated/graphql";


let surveyId: any
let authToken: any
let formId: any


function generateSlug() { 
  const result = Math.random().toString(36).substring(2,7);
  return result
}

const slug = generateSlug()

describe("Survey creation smoke test", () => {
  describe ('Creates survey', () => {
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
    it ("Can get form elements from fixture", () => {
      cy.updateSurveyForm(3, "sadlfjasdfl").then((resp) => {
        let element = resp[0]
        expect (element).to.have.property('typeId')
      })
    })
  })
  describe("User survey flow", () => {
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
              let id = resp.makeSurvey.survey.id
              cy.updateSurvey(id, access_token)
              //cy.wrap(resp.makeSurvey.survey.form.id).as('formId')
              cy.wrap(id).as('surveyId')
            })
          });
        });
        cy.get('@surveyId').then((id) => {
          cy.visit(`${slug}/surveys/${id}`)
        })
      });
    })
    afterEach(() => {
      cy.deleteProject(`${slug}`)
    })
    it("Can visit the survey", () => {
      cy.contains('Begin', {timeout: 30000}).click()
    })
  })
})


//cy.createProject
//store project Id
//cy.createSurvey
//project id
//enabled
//creator






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
