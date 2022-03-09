/* eslint-disable cypress/no-unnecessary-waiting */
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
  describe ('Survey creation Cypress commands', () => {
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
           cy.get('@surveyId').then((id) => {
            surveyId = id
            cy.deleteSurvey(surveyId, authToken)
          })
         })
       })
    })
    it ("Can update form with form elements", () => {
      cy.get('@formId').then((id) => {
        formId = id 
        cy.get("@token").then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken).then((resp) => {
            const elementsToUpdate = []
            resp.deleteFormElement.query.form.formElements.forEach(t => {
              elementsToUpdate.push(t)
            })
            cy.updateFormElements(elementsToUpdate,"Maldives", authToken, formId)
          })
          cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
            expect (resp.createFormElement.query.form.formElements.length).to.be.gt(3)
            cy.createSAPElements((formId + 1), "Maldives", authToken).then((resp) => {
              expect (resp.createFormElement.query.form.formElements.length).to.be.gt(2)
            })
          })
          cy.get('@surveyId').then((id) => {
            surveyId = id
            cy.deleteSurvey(surveyId, authToken)
          })
        })
      })
    })
    it ("Can update jumpToId field on form elements", () => {
      cy.get('@formId').then((id) => {
        formId = id 
        cy.get("@token").then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken).then((resp) => {
            const elementsToUpdate = []
            resp.deleteFormElement.query.form.formElements.forEach(t => {
              elementsToUpdate.push(t)
            })
            cy.updateFormElements(elementsToUpdate,"Maldives", authToken, formId)
          })
          cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
            const elements = resp.createFormElement.query.form.formElements
            let jumpToId
            const elementsToUpdate = elements.splice(6,19)
            for (let i = 0; i < elements.length; i++) {
              if (elements[i].typeId === "SpatialAccessPriorityInput") {
                jumpToId = elements[i].id
                break
              }
            }
            cy.updateJumpToId(jumpToId, elementsToUpdate, formId, authToken).then((resp) => {
             expect (resp.updateFormElement.formElement.jumpToId).to.eq(jumpToId)
            })
          })
          cy.get('@surveyId').then((id) => {
            surveyId = id
            cy.deleteSurvey(surveyId, authToken)
          })
        })
      })
    })
    it ("Can update form with logic rules and conditions", () => {
      cy.get('@formId').then((id) => {
        formId = id 
        cy.get("@token").then((token) => {
          authToken = token
          cy.deleteFormElements(formId, authToken).then((resp) => {
            const elementsToUpdate = []
            resp.deleteFormElement.query.form.formElements.forEach(t => {
              elementsToUpdate.push(t)
            })
            cy.updateFormElements(elementsToUpdate,"Maldives", authToken, formId)
          })
          cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
            //formElements are the newly created elements in addition to WelcomeMessage, 
            //SaveScreen and ThankYou. There are 34 total.
            const formElements = resp.createFormElement.query.form.formElements
            console.log(formElements)
            let jumpToId
            ////elementsToUpdate are the elements whose jumpToId needs to be updated 
            ////to represent the id of the "What sectors do you represent question". 
            ////These elements consist of the island questions
            const elementsToUpdate = formElements.splice(6,19)
            console.log(elementsToUpdate)
            ////Get the id of the "What sectors do you represent question" and save as jumpToId
            for (let i = 0; i < formElements.length; i++) {
              if (formElements[i].typeId === "SpatialAccessPriorityInput") {
                jumpToId = formElements[i].id
                break
              }
            }
            cy.updateJumpToId(jumpToId, elementsToUpdate, formId, authToken).then((resp) => {
              console.log(resp)
            })
              let baseId = 0
              let ids = []
              function getIds(baseId) {
                if (baseId === 0) {
                  for(let i=0; i<formElements.length; i++) {
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
                  for(let i=0; i < 20; i++) {
                    ids.push(baseId++)
                  }
                }
                return ids
              }
              let newIds = getIds(baseId)
              newIds.push(newIds[19] + 6)
              newIds.push(newIds[20] + 1)
              console.log(newIds)
              expect (newIds.length).to.eq(22)
              cy.createFormLogicRules(formId, "Maldives", newIds, authToken).then((resp) => {
              console.log(resp)
                expect (resp.createFormLogicCondition.query.form.logicRules.length).does.not.eq(0)
                expect (resp.createFormLogicCondition.query.form.logicRules[0].conditions.length).does.not.eq(0)
              })
            })   
          })
          cy.get('@surveyId').then((id) => {
            surveyId = id
            cy.deleteSurvey(surveyId, authToken)
          })
        })
      })
    })
  describe.only ('User survey flow', () => {
    before(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProjectRequest"
        } else if ((req.body.operationName) && (req.body.operationName === "CypressCreateSurvey")) {
          req.alias = "createSurveyRequest"
        } else if ((req.body.operationName) && (req.body.operationName === "CypressCreateFormLogicRule")) {
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
              cy.updateSurvey(resp.makeSurvey.survey.id, access_token)
              cy.get('@formId').then((id) => {
                formId = id
                cy.deleteFormElements(formId, access_token).then((resp) => {
                  const elementsToUpdate = []
                  resp.deleteFormElement.query.form.formElements.forEach(t => {
                    elementsToUpdate.push(t)
                  })
                  cy.updateFormElements(elementsToUpdate,"Maldives", access_token, formId)
                  console.log(access_token)
                  cy.createFormElements(formId, "Maldives", access_token).then((resp) => {
                    const SAPFormId = formId + 1
                    cy.createSAPElements(SAPFormId, "Maldives", access_token)
                    const formElements = resp.createFormElement.query.form.formElements
                    let jumpToId
                    const elementsToUpdate = formElements.splice(6,19)
                    for (let i = 0; i < formElements.length; i++) {
                      if (formElements[i].typeId === "SpatialAccessPriorityInput") {
                        jumpToId = formElements[i].id
                        break
                      }
                    }
                    cy.updateJumpToId(jumpToId, elementsToUpdate, formId, access_token)
                      let baseId = 0
                      let ids = []
                      function getIds(baseId) {
                        if (baseId === 0) {
                          for(let i=0; i<formElements.length; i++) {
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
                          for(let i=0; i < 20; i++) {
                            ids.push(baseId++)
                          }
                        }
                        return ids
                      }
                      let newIds = getIds(baseId)
                      newIds.push(newIds[19] + 6)
                      newIds.push(newIds[20] + 1)
                      console.log(newIds)
                      cy.createFormLogicRules(formId, "Maldives", newIds, access_token)
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
    it("Cannot advance until name is provided", () => {
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
    it("Cannot advance until atoll selection is made", () => {
      cy.contains("Which Atoll do you reside on?")
        .get('[title = "Next Question"]')
        .should('have.class', "pointer-events-none")
      cy.contains('N').click()
    })
    it("Advances to appropriate island selection page", () => {
      cy.contains('Which island of N atoll do you reside on?', {timeout: 30000})
      cy.contains('Lhohi')
    })
    it("Cannot advance until island selection is made", () => {
      cy.get('[title = "Next Question"]')
        .should('have.class', "pointer-events-none")
      cy.contains('Kudafari').click()
    })
    it("Cannot advance until sector selection(s) is made", () => {
      cy.get('[type = "button"]').as('nextBtn')
      cy.get('@nextBtn').should('be.hidden')
      cy.get('[title = "Next Question"]').as('next')
        .should('have.class', "pointer-events-none")
      cy.contains('Fisheries - Commercial, Tuna').click()
      cy.get('@next').scrollIntoView()
      cy.get('@nextBtn').then(($btn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect ($btn).to.be.visible
      })
      
    })
    it("Can advance to map page", () => {
      cy.get('[type = "button"]').as('nextBtn').click()
    })
    //it("Can select multiple sectors", () => {
    //  cy.get('[type = "button"]').as('nextBtn')
    //  cy.get('[title = "Fisheries - Commercial, Tuna"]').then(($el) => {
    //    expect ($el).to.have.descendants('svg')
    //  })
    //  cy.get('[title = "Aquaculture / Mariculture"]').click().then(($el) => {
    //    expect ($el).to.have.descendants('svg')
    //  })
    //  cy.get('@nextBtn').click()
    //})
    it("Can draw a polygon", () => {
      cy.wait(10000)
      cy.get('.mapboxgl-canvas').each((t) => {
        const canvases = []
        canvases.push(t)
        return canvases
      }).then((ary) => {
        console.log(ary[0])
        const el = ary[0]
        return el
      }).as('el')
      cy.get('@el').click(300,300)        
        .click(300, 100)
        .click(100, 100)
        .click(100, 300)
        .dblclick(300, 300)
        //.wait(8000)
        //.dblclick(400,200)
      cy.contains('Done').click()
      //invalid shape
      //cy.get('.mapboxgl-canvas').click(300, 300)
      //  .click(100, 600)
      //  .click(300, 600)
      //  .click(300, 300)
      //  .click(400, 400)
      //  .dblclick(300,300)
      //cy.get('[name = "Finish Shape"]')
    })
    //it("Can assign attributes to the polygon", () => {
    //  cy.get(".mt-1 > .block").clear()
    //    .type("A dope fishing spot for yellowfin tuna")
    //  cy.get('[title="Handline"]').click()
    //  cy.get('[title="Yellowfin"]').click()
    //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in fall and winter.")
    //  cy.contains('Save').click()
    //})
    //it("Correctly records attributes", () => {
    //  cy.contains("A dope fishing spot for yellowfin tuna")
    //  
    //})
    //it("Can finish sector", () => {
    //  cy.contains('Finish Sector', {timeout: 6000}).then(($btn) => {
    //    cy.get($btn, {timeout: 6000}).click()
    //  })
    //  //cy.contains('Next Question').click()
    //})
  })//
})//
//
//
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
