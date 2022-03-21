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
  describe ('User survey flow', () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CreateResponse")) {
          req.alias = "createResponse"
        }
        if ((req.body.operationName) && (req.body.operationName === "Survey")) {
          req.alias = "getSurvey"
        }
      })
      cy.intercept("https://api.mapbox.com/map-sessions/*").as('getBasemaps')
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
       
      });
    })
    after(() => {
      cy.restoreLocalStorage()
      cy.getLocalStorage("surveyId").then((id) => {
        surveyId = parseInt(id)
        //cy.getLocalStorage("responseId").then((responseId) => {
        //  cy.deleteResponse
        //})
        //cy.getLocalStorage("token").then((token) => {
        //  cy.deleteSurvey(surveyId, token)
        //})
      })
      cy.deleteProject(`${slug}`) 
    })
    it("Can visit the survey", () => {
      cy.wait('@getSurvey').its('response.statusCode').should('eq', 200)
      cy.get('.select-none').should('be.visible').then(($btn) => {
        {$btn.trigger('click')}
      })
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
      cy.get('[type = "button"]').as('nextBtn').should('be.hidden')
      
      cy.get('[title = "Next Question"]').as('next')
        .should('have.class', "pointer-events-none")
      cy.contains('Fisheries - Commercial, Tuna').click()
      cy.get('@nextBtn').scrollIntoView()
      cy.get('@nextBtn').should('be.visible').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    //it("Can draw a polygon", () => {
    //  cy.contains("Fisheries - Commercial, Tuna")
    //  cy.wait('@getBasemaps')
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
    //  cy.contains('Done').click()
    //})
    //it("Can assign attributes to the polygon", () => {
    //  cy.get(".mt-1 > .block").clear()
    //    .type("A great fishing spot for yellowfin tuna.")
    //  cy.get('[title="Handline"]').click()
    //  cy.get('[title="Yellowfin"]').click()
    //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.")
    //  cy.contains('Save').click()
    //})
    //it("Correctly records attributes", () => {
    //  cy.contains("A great fishing spot for yellowfin tuna.")
    //  
    //})
    //it("Can finish sector", () => {
    //  cy.contains("A great fishing spot for yellowfin tuna.")
    //  cy.contains("Fisheries - Commercial, Tuna")
    //  cy.get(".space-y-2 > :nth-child(2) > .select-none").should('be.visible').then(($el) => {
    //    {$el.trigger('click')}
    //  })
    //  cy.contains("Your sectors")
    //  cy.contains("Next Question").as("nextQuestion")
    //  cy.get("@nextQuestion").should('be.visible').then(($btn) => {
    //    {$btn.trigger('click')}
    //  })
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
    //  cy.contains("Complete Submission").as('completeSubmission')
    //  cy.get('@completeSubmission').should('be.visible').then(($btn) => {
    //    {$btn.trigger('click')}
    //  })
    //  cy.wait("@createResponse").then((req) => {
    //    const surveyResponseId = req.response.body.data.createSurveyResponse.surveyResponse.id
    //    expect (surveyResponseId).to.not.equal(null)
    //    cy.restoreLocalStorage()
    //    cy.getLocalStorage("access_token").then((token) => {
    //      cy.getSurveyResponse(surveyResponseId, token).then((resp) => {
    //        const data = resp.query.surveyResponse.data
    //        const ary = []
    //        Object.entries(data).forEach(([, value]) => {
    //          ary.push(value)
    //        })
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
    //        //cy.setLocalStorage('responseId', surveyResponseId)
    //      })
    //    })
    //  })
    //})
  })
})