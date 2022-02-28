//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { ProjectAccessControlSetting } from "../../../src/generated/graphql";
import "cypress-localstorage-commands"

let surveyId: any
let authToken: any
let formId: any


function generateSlug() { 
  const result = Math.random().toString(36).substring(2,7);
  return result
}

const slug = generateSlug()

describe("Survey creation smoke test", () => {
  describe.only ('Survey creation Cypress commands', () => {
    beforeEach(() => {
      //slug = generateSlug()
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProjectRequest"
        } else if ((req.body.operationName) && (req.body.operationName === "CypressCreateSurvey")) {
          req.alias = "createSurveyRequest"
        } else if ((req.body.operationName) && (req.body.operationName === "CypressCreateFormElement")) {
          req.alias = "createFormElementRequest"
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
          cy.wrap(projectId).as("projectId")
          cy.createSurvey(
            `Maldives Ocean Use Survey Test - ${slug}`, 
            projectId, 
            access_token
          ).then((resp) => {
            cy.wrap(resp.makeSurvey.survey.form.id).as('formId')
            cy.wrap(resp.makeSurvey.survey.form.formElements).as('formElements')
            cy.wrap(resp.makeSurvey.survey.id).as('surveyId')
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
    })
    it ("Creates the survey", () => {
      cy.wait("@createSurveyRequest").its('response').then((resp) => {
        const formElements = resp.body.data.makeSurvey.survey.form.formElements
        expect (formElements.length).to.eq(5)
      }) 
    })
    it ("Updates the survey's isDisabled field", () => {
      cy.get("@surveyId").then((id) => {
        surveyId = id
        cy.get('@token').then((token) => {
          authToken = token
          cy.updateSurvey(surveyId, authToken).then((resp) => {
            expect (resp.updateSurvey.survey.isDisabled).to.eql(false)
            expect (resp.updateSurvey.survey.accessType).to.eql('PUBLIC')
          })
        })
      })
    })
    it ("Can delete the survey", () => {
      cy.get("@surveyId").then((id) => {
        surveyId = id
        cy.get('@token').then((token) => {
          authToken = token
          cy.deleteSurvey(surveyId, authToken).then((resp) => {
            expect (resp.deleteSurvey.survey.id).to.eql(surveyId)
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
            expect (resp.deleteFormElement.query.form.formElements.length).to.eq(3)
            console.log(resp)
          })
        })
      })
    })
    it ("Can update default form elements required by survey", () => {
      cy.get('@formId').then((id) => {
        formId = id
         cy.get('@token').then((token) => {
           authToken = token
           cy.deleteFormElements(formId, authToken).then((resp) => {
             const elementsToUpdate = []
             resp.deleteFormElement.query.form.formElements.forEach(t => {
               elementsToUpdate.push(t)
             })
             expect (elementsToUpdate.length).to.eq(3)
              cy.updateFormElements(elementsToUpdate,"Maldives", authToken, formId).then((resp) => {
                expect (resp.updateFormElement.query.form.formElements.length).to.eq(3)
                expect (resp.updateFormElement.query.form.formElements[0].body.content[0].content[0].text).to.eq("Welcome Ocean Users!")
             })
           })
         })
       })
    })
    //it ("Can update form with form elements", () => {
    //  cy.get('@formId').then((id) => {
    //    formId = id 
    //    cy.get("@token").then((token) => {
    //      authToken = token
    //      cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
    //        expect (resp.createFormElement.query.form.formElements.length).to.be.gt(3)
    //      })
    //      cy.get('@surveyId').then((id) => {
    //        surveyId = id
    //        cy.deleteSurvey(surveyId, authToken)
    //      })
    //    })
    //  })
    //})
    //it ("Can update form with logic rules", () => {
    //  cy.wait("@createSurveyRequest")
    //  cy.get('@formId').then((id) => {
    //    formId = id 
    //    cy.get("@token").then((token) => {
    //      authToken = token
    //      cy.deleteFormElements(formId, authToken)
    //      cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
    //        const formElements = resp.createFormElement.query.form.formElements
    //        expect (formElements.length).to.be.gt(3)
    //        let baseId = 0
    //        let ids = []
    //        function getIds(baseId) {
    //          if (baseId === 0) {
    //            for(let i=0; i<formElements.length; i++) {
    //              if (
    //                formElements[i].typeId && 
    //                formElements[i].typeId === "MultipleChoice" && 
    //                formElements[i].body.content[0].content[0].text === "Which Atoll do you reside on?"
    //                ){
    //                baseId = formElements[i].id
    //                break
    //              }
    //            } 
    //            getIds(baseId)
    //          } else {
    //            for(let i=0; i < 20; i++) {
    //              ids.push(baseId++)
    //            }
    //          }
    //          return ids
    //        }
    //        let newIds = getIds(baseId)
    //        newIds.push(newIds[19] + 6)
    //        newIds.push(newIds[20] + 1)
    //        expect (newIds.length).to.eq(22)
    //        cy.createFormLogicRules(formId, "Maldives", newIds, authToken).then((resp) => {
    //          console.log(resp)
    //          expect (resp.createFormLogicCondition.query.form.logicRules.length).to.eq(19)
    //          //expect (resp.createFormLogicCondition.query.form.logicRules.conditions).to.have.ownProperty('length')
    //          //expect (resp.createFormLogicCondition.query.form.logicRules[0].conditions).to.exist
    //          //console.log(resp.createFormLogicCondition.query.form.logicRules[0].conditions).to.exist
    //        })
    //      })
    //      cy.get('@surveyId').then((id) => {
    //        surveyId = id
    //        cy.deleteSurvey(surveyId, authToken)
    //      })
    //      
    //    })
    //  })
    //})
  })
  describe ('User survey flow', () => {
    before(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName == "CypressCreateProject")) {
          req.alias = "createProjectRequest"
        } else if ((req.body.operationName) && (req.body.operationName == "CypressCreateSurvey")) {
          req.alias = "createSurveyRequest"
        } else if ((req.body.operationName) && (req.body.operationName == "CypressCreateFormLogicRule")) {
          req.alias = "createFormLogicRule"
        }
      })
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token)
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
              cy.setLocalStorage("surveyId", resp.makeSurvey.survey.id)
              cy.saveLocalStorage()
              cy.wrap(resp.makeSurvey.survey.form.id).as('formId')
              cy.wrap(resp.makeSurvey.survey.form.formElements).as('formElements')
              cy.wrap(resp.makeSurvey.survey.id).as('surveyId')
              cy.updateSurvey(resp.makeSurvey.survey.id, access_token).then((resp) => {
                console.log(resp)
              })
              cy.get('@formId').then((id) => {
                formId = id
                cy.deleteFormElements(formId, access_token).then((resp) => {
                  console.log(resp)
                  cy.createFormElements(formId, "Maldives", access_token).then((resp) => {
                    console.log(resp)
                    const formElements = resp.createFormElement.query.form.formElements
                    let baseId = 0
                    let ids = []
                    function getIds(baseId) {
                      if (baseId === 0) {
                        for(let i=0; i<formElements.length; i++) {
                          console.log("base id = 0")
                          if (
                            formElements[i].typeId && 
                            formElements[i].typeId === "MultipleChoice" && 
                            formElements[i].body.content[0].content[0].text === "Which Atoll do you reside on?"
                            ){
                            baseId = formElements[i].id
                            break
                          }
                        } 
                        getIds(baseId)
                      } else {
                        console.log("base id != 0")
                        for(let i=0; i < 20; i++) {
                          ids.push(baseId++)
                        }
                      }
                      return ids
                    }
                    //gather newIds through getIds function
                    let newIds = getIds(baseId)
                    console.log(newIds)
                    //account for last  two logic rules with formElementIds 98 and 99
                    newIds.push(newIds[0] + 24)
                    newIds.push(newIds[0] + 25)
                    console.log(newIds[0])
                    cy.createFormLogicRules(formId, "Maldives", newIds, access_token).then((resp) => {
                      const formElementIds = []
                      console.log(resp.createFormLogicRule.query.form.logicRules)
                      formElementIds.push(resp.createFormLogicRule.query.form.logicRules[0].formElementId)
                      console.log(formElementIds)
                      //cy.createFormLogicConditions(formElementIds, "Maldives", access_token, formId)
                     
                      //console.log(resp.createFormLogicCondition.query.form.logicRules)
                      //expect (resp.createFormLogicCondition.query.form.logicRules.length).to.eq(19)
                    })
                  })
                })
              })
            })
          });
        });
        cy.get("@surveyId").then((id) => {
        cy.visit(`${slug}/surveys/${id}`)
        })
        //cy.wait("@createFormLogicRule")
      });
    })
    after(() => {
      cy.restoreLocalStorage()
      cy.getLocalStorage("surveyId").then((id) => {
        surveyId = parseInt(id)
        console.log(surveyId)
        //cy.getLocalStorage("token").then((token) => {
        //  cy.deleteSurvey(surveyId, token)
        //})
      })
      //cy.deleteProject(`${slug}`) 
    })
    it("Can visit the survey", () => {
       cy.contains('Begin', {timeout: 30000}).click()
    })
    it("Cannot progress until name is provided", () => {
      cy.contains("What is your name?")
        .get('[title = "Next Question"]')
        .should('have.class', "pointer-events-none")
        .get("input").type("Test User 1") 
        .get("button").contains("Next").click()
    })
    it("Can input email address or can skip question", () => {
      cy.get("input")
      cy.contains("Skip Question").click()
    })
  })
})


//Refactor
//Consolidate
//Move command tests to command tests folder
//Conditional checks
//Before vs beforeEach; after vs afterEach
//Why is the formId alias not found in afterEach action?
//Why is the createFormElement request alias not found in cy.wait?
//Change slug to same slug across commands tests
//Delete form request - needed for delete project in after each, but not working
//; projects are persisting to database after "can update form with elements"
//Move separate but related commands/requests together




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
