/* eslint-disable cypress/no-unnecessary-waiting */
//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { CursorType, ProjectAccessControlSetting } from "../../../src/generated/graphql";
import "cypress-localstorage-commands"
import { verify } from "crypto";
import { VariablesInAllowedPositionRule } from "graphql";

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
            const SAPFormId = formId + 1
            cy.createSAPElements(SAPFormId, "Maldives", authToken)
            //formElements are the newly created elements in addition to WelcomeMessage, 
            //SaveScreen and ThankYou. There are 34 total.
            const formElements = resp.createFormElement.query.form.formElements
            console.log(formElements)
            let jumpToId
            ////elementsToUpdate are the elements whose jumpToId needs to be updated 
            ////to represent the id of the "What sectors do you represent question". 
            ////These elements consist of the island questions
            const elementsToUpdate = formElements.slice(5,24)
            console.log(elementsToUpdate)
            ////Get the id of the "What sectors do you represent question" and save as jumpToId
            for (let i = 0; i < formElements.length; i++) {
              if (formElements[i].typeId === "SpatialAccessPriorityInput") {
                jumpToId = formElements[i].id
                console.log(jumpToId)
                break
              }
            }
            const updateSubToIdElements = []
            formElements.forEach((t) => {
              console.log(t.body.content[0].content[0].text)
              if (
               t.body.content[0].content[0].text === "If you are representing a guesthouse, please provide the name of your establishment:"
              ) {
              updateSubToIdElements.push(t)
              }
              else if (
                t.body.content[0].content[0].text === "Please indicate how many people are reflected in this response"
              ) {
               updateSubToIdElements.push(t)
              }
              else if (
                t.body.content[0].content[0].text === "Are you a part-time or full-time fisher?"
              ) {
                updateSubToIdElements.push(t)
              } else if (
                t.body.content[0].content[0].text === "Please provide the name or the number of the vessel you fish on"
              ) {
                updateSubToIdElements.push(t)
              }
            })
            expect (updateSubToIdElements.length).to.eq(4)
            cy.updateSubordinateToId(jumpToId, updateSubToIdElements, formId, authToken).then((resp) => {
              const elements = resp.updateFormElement.query.form.formElements
              for(let i=0; i < elements.length; i++) {
                if (elements[i].subordinateTo !== null) {
                  expect (elements[i].subordinateTo).to.eq(jumpToId)
                  break
                }
              }
          
            })
            cy.updateJumpToId(jumpToId, elementsToUpdate, formId, authToken)
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
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CreateResponse")) {
          req.alias = "createResponse"
        }
        if ((req.body.operationName) && (req.body.operationName === "CurrentProjectMetadata")) {
          req.alias = "currentProjectMetadata"
        }
        //if ((req.body.operationName) && (req.body.operationName === "GetBasemapsAndRegion")) {
        //  req.alias = "getBasemaps"
        //}
      })
      cy.intercept("https://api.mapbox.com/map-sessions/*").as('basemaps')
    })
    before(() => {
      cy.setLocalStorage("slug", slug)
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
              cy.setLocalStorage("access_token", access_token)
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
                    const elementsToUpdate = formElements.slice(5,24)
                    for (let i = 0; i < formElements.length; i++) {
                      if (formElements[i].typeId === "SpatialAccessPriorityInput") {
                        jumpToId = formElements[i].id
                        break
                      }
                    }
                    cy.updateJumpToId(jumpToId, elementsToUpdate, formId, access_token)
                    const updateSubToIdElements = []
                    formElements.forEach((t) => {
                      console.log(t.body.content[0].content[0].text)
                      if (
                       t.body.content[0].content[0].text === "If you are representing a guesthouse, please provide the name of your establishment:"
                      ) {
                      updateSubToIdElements.push(t)
                      }
                      else if (
                        t.body.content[0].content[0].text === "Please indicate how many people are reflected in this response"
                      ) {
                       updateSubToIdElements.push(t)
                      }
                      else if (
                        t.body.content[0].content[0].text === "Are you a part-time or full-time fisher?"
                      ) {
                        updateSubToIdElements.push(t)
                      } else if (
                        t.body.content[0].content[0].text === "Please provide the name or the number of the vessel you fish on"
                      ) {
                        updateSubToIdElements.push(t)
                      }
                    })
                     cy.updateSubordinateToId(jumpToId, updateSubToIdElements, formId, access_token)
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
        cy.getLocalStorage("token").then((token) => {
          cy.deleteSurvey(surveyId, token)
        })
      })
      cy.deleteProject(`${slug}`) 
    })
    it("Can visit the survey", () => {
      //wait for first request
      cy.wait('@currentProjectMetadata').its('response.statusCode').should('eq', 200)
      //wait for second request
      cy.wait('@currentProjectMetadata').its('response.statusCode').should('eq', 200)
      cy.contains('Begin').click()
    })
    it("Cannot advance until name is provided", () => {
      cy.contains("What is your name?")
        .get('[title = "Next Question"]')
        .should('have.class', "pointer-events-none")
        .get("input").type("Test User 1") 
        .get("button").contains("Next").click()
    })
    it("Can input email address or can skip question", () => {
      cy.contains("What is your email address?")
      cy.get("input").should('be.visible')
      cy.get("input")
      //cy.url().should('eq', Cypress.config().baseUrl + '/projects');
      //cy.get("input")
      ////cy.get("input")
      ////cy.get("input")
      .type("test_user_1@seasketch.org")
      cy.contains("Next").click()
    })
    it("Cannot advance until atoll selection is made", () => {
      cy.contains("Which Atoll do you reside on?")
        .get('[title = "Next Question"]')
        .should('have.class', "pointer-events-none")
      cy.contains('N').click()
    })
    it("Advances to appropriate island selection page", () => {
      cy.contains('Which island of N atoll do you reside on?')
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
      cy.get('@nextBtn').should('be.visible').then(($btn) => {
        {$btn.trigger('click')}
      })
      //cy.contains("Next", {timeout: 6000}).click()
    })
    //it("Can advance to map page", () => {
    //  cy.contains('Fisheries - Commercial, Tuna').click()
    //  cy.contains("Next")
    //  cy.get('[type = "button"]').as('nextBtn')
    //  cy.get('@nextBtn')//.click()
    //  cy.get('@nextBtn').click()
    //})
    ////it("Can select a sector", () => {
    ////  cy.get('[type = "button"]').as('nextBtn')
    ////  cy.get('[title = "Fisheries - Commercial, Tuna"]').then(($el) => {
    ////    expect ($el).to.have.descendants('svg')
    ////  })
    ////  cy.get('@nextBtn').click()
    ////////  cy.get('[title = "Aquaculture / Mariculture"]').click().then(($el) => {
    ////////    expect ($el).to.have.descendants('svg')
    //////  })
    //////  cy.get('@nextBtn').click()
    //})
    //it("Can draw a polygon", () => {
    //  cy.contains("Fisheries - Commercial, Tuna")
    //  cy.wait('@basemaps')
    //  cy.get('.mapboxgl-canvas').each((t) => {
    //    const canvases = []
    //    canvases.push(t)
    //    return canvases
    //}).then((ary) => {
    ////////    console.log(ary[0])
    //    const el = ary[0]
    //    return el
    //  }).as('el')
    //  cy.get('@el').click(300,300)        
    //    .click(300, 100)
    //    .click(100, 100)
    //    .click(100, 300)
    //    .dblclick(300, 300)
    //    //.wait(8000)
    //    //.dblclick(400,200)
    //  cy.contains('Done').click()
    //  ////invalid shape
    //  ////cy.get('.mapboxgl-canvas').click(300, 300)
    //  ////  .click(100, 600)
    //  ////  .click(300, 600)
    //  ////  .click(300, 300)
    //  ////  .click(400, 400)
    //  ////  .dblclick(300,300)
    //  ////cy.get('[name = "Finish Shape"]')
    //})//
    //it("Can assign attributes to the polygon", () => {
    //  cy.get(".mt-1 > .block").clear()
    //    .type("A great fishing spot for yellowfin tuna.")
    //  cy.get('[title="Handline"]').click()
    //  cy.get('[title="Yellowfin"]').click()
    //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.")
    //  cy.contains('Save').click()
    //})
    ////it("Correctly records attributes", () => {
    ////  cy.contains("A great fishing spot for yellowfin tuna.")
    ////  
    ////})
    //it("Can finish sector", () => {
    //  cy.contains("A great fishing spot for yellowfin tuna.")
    //  cy.contains("Fisheries - Commercial, Tuna")
    //  //cy.wait(10000)
    //  //cy.contains('Finish Sector', {timeout: 8000}).click()
    //  cy.contains("Finish Sector").trigger('click', {force: true})
    //  //cy.get(".space-y-2 > :nth-child(2) > .select-none").as('finishSector')
    //  //cy.get('@finishSector', {timeout: 10000}).click()
    //  //cy.get('@finishSector')
    //  //cy.get('@finishSector').click()
    //  //
    //  //cy.contains("Your sectors")
    //  //cy.contains("Next Question").as("nextQuestion")
    //  //cy.get("@nextQuestion")
    //  //cy.get("@nextQuestion").click()
    //  //cy.wait(10000)
    //  //cy.contains('Next Question').click()
    //  //cy.get('.select-none').click()
    //})
    //it("Can answer supplemental questions", () => {
    //  cy.contains('Are you willing to answer a few additional questions about who you are?')
    //  cy.contains('Yes').click()
    //})
    //it("Can input age", () => {
    //  cy.contains("Your age")
    //  cy.get('input').clear().type("28")
    //  cy.contains('Next').click()
    //})
    //it("Can select gender", () => {
    //  cy.contains("Gender")
    //  cy.contains("Female").click()
    //})
    //it("Can add comments", () => {
    //  cy.get("textarea").type("My general comments.")
    //})
    //it("Records the correct response", () => {
    //  cy.contains("Complete Submission").click()
    //  cy.wait(8000)
    //  cy.contains("Thank You for Responding")
    //  cy.wait("@createResponse").then((req) => {
    //    const surveyResponseId = req.response.body.data.createSurveyResponse.surveyResponse.id
    //    expect (surveyResponseId).to.not.equal(null)
    //    cy.restoreLocalStorage()
    //    cy.getLocalStorage("access_token").then((token) => {
    //      cy.getSurveyResponse(surveyResponseId, token).then((resp) => {
    //        const data = resp.query.surveyResponse.data
    //        const responses = ['Test User 1', "test_user_1@seasketch.org", 'N']
    //        const ary = []
    //        Object.entries(data).forEach(([, value], index) => {
    //          ary.push(value)
    //        })//;
    //        expect(ary.length).to.eq(9)
    //        expect (ary[0].name).to.eq('Test User 1')
    //        expect (ary[1]).to.eq('test_user_1@seasketch.org')
    //        expect (ary[2][0]).to.eq('N')
    //        expect (ary[3][0]).to.eq('Kudafari')
    //        expect (ary[4].sectors[0]).to.equal("Fisheries - Commercial, Tuna")
    //        expect (ary[5]).to.eq(true)
    //        expect (ary[6]).to.eq(28)
    //        expect (ary[7][0]).to.eq('Female')
    //        expect (ary[8]).to.eq("My general comments.")
    //        console.log(ary)
    //        //function find(array, criteriaFn) {
    //        //  let current = array
    //        //  let next = []
    //        //  while (current || current === 0) {
    //        //    // if `current` satisfies the `criteriaFn`, then
    //        //    // return it — recall that `return` will exit the
    //        //    // entire function!
    //        //    if (criteriaFn(current)) {
    //        //      assert(current, `${current} is present in survey response`)
    //        //      //current = next.shift()
    //        //      //return current
    //        //    }
    //        //
    //        //    // if `current` is an array, we want to push all of
    //        //    // its elements (which might be arrays) onto `next`
    //        //    if (typeof current === 'object') {
    //        //      for (let i = 0; i < current.length; i++) {
    //        //        next.push(current[i])
    //        //      }
    //        //    }
    //        //
    //        //    // after pushing any children (if there
    //        //    // are any) of `current` onto `next`, we want to take
    //        //    // the first element of `next` and make it the
    //        //    // new `current` for the next pass of the `while`
    //        //    // loop
    //        //    current = next.shift()
    //        //  }
    //        //  //return null
    //        //}
    //        //responses.forEach((t) => {
    //        //  find(ary, resp => resp === t)
    //        //})
    //        
    //        //data.forEach((t) => {
    //        //  responses.push(t)
    //        //})
    //        //console.log(responses)
    //        //for(let i = 0; i < data.length; i++) {
    //        //  console.log(data[i])
    //        //}
    //        //for (const [index, [, value]] of Object.entries(Object.entries(data))) {
    //        //  console.log(`${index}: ${value}`);
    //        //}
    //        
    //        //const objects = []
    //       
    //      })
    //    })
    //  })
    //})
  })//
})////
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
