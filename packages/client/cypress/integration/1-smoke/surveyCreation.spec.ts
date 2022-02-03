//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { ProjectAccessControlSetting, useCreateSurveyMutation } from "../../../src/generated/graphql";

let surveyId: any
let authToken: any


describe.only ('Creates and deletes survey', () => {
    
  beforeEach(() => {
      //cy.intercept("http://localhost:3857/graphql").as('request')
    cy.intercept("http://localhost:3857/graphql", (req) => {
      if ((req.body.operationName) && (req.body.operationName == "CypressCreateProject")) {
        req.alias = "createProjectRequest"
      } else if ((req.body.operationName) && (req.body.operationName == "CypressCreateSurvey")) {
        req.alias = "createSurveyRequest"
      }
    })
    cy.getToken("User 1").then(({ access_token }) => {
      console.log(access_token)
      cy.wrap(access_token).as("token");
      cy.createProject(
        "Maldives Spatial Planning Test",
        "cy-maldives",
        ProjectAccessControlSetting.Public,
        true
      )
      .then((projectId) => {
        cy.wrap(projectId).as("projectId").then(() => {
          cy.createSurvey(
            "Maldives Ocean Use Survey Test", 
            projectId, 
            access_token
          ).then((resp) => {
            cy.wrap(resp.makeSurvey.survey.id).as('surveyId')
          })
        });
      });
    });
  })
  afterEach(() => {
    cy.deleteProject("cy-maldives")
    //delete the survey
    cy.get("@token").then((token) => {
      authToken = token
    })
    cy.get('@surveyId').then((id) => {
      surveyId = id
      cy.deleteSurvey(surveyId, authToken)
    })
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
  it ("Updates the survey's isDisabled and accessType fields", () => {
    cy.get("@surveyId").then((id) => {
      console.log(id)
      surveyId = id
      cy.get('@token').then((token) => {
        authToken = token
        cy.updateSurvey(surveyId, authToken).then((resp) => {
          expect (resp.updateSurvey.survey.isDisabled).to.equal(false)
          expect (resp.updateSurvey.survey.accessType).to.equal('PUBLIC')
        })
      })
      //cy.visit(`/cymaldives/admin/surveys/${surveyId}`)
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
