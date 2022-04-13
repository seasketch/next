/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { createPublicKey } from "crypto";
import { getByDataCy } from "../../support/utils/utils.js"

let surveyId: any;
let authToken: any;
let formId: any;


function generateSlug() { 
  const result = Math.random().toString(36).substring(2,7);
  return result
}

function checkForNavAndLang() {
    //navigation and language buttons
    cy.get('[title="Previous Question"]').should('be.visible').and('exist')
    cy.get('[title="Next Question"]').should('be.visible').and('exist')
    cy.get('button.px-3')
      .should('be.visible')
}

const drawPolygon = () => {
  cy.get('.mapboxgl-canvas').each((t) => {
    const canvases = []
    canvases.push(t)
    return canvases
  }).then((ary) => {
    console.log(ary)
    const el = ary[0]
    console.log(el)
    return el
  }).as('el')
  
  cy.get('@el').click(300,300)        
    .click(300, 100)
    .click(100, 100)
    .click(100, 300)
    .dblclick(300, 300)
}


const devices: any = [ "iphone-x", "iphone-5", "macbook-15", "ipad-2"];

describe("Survey creation smoke test", () => {
  describe.only('User survey flow', () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CreateResponse")) {
          req.alias = "createResponse"
        };
        if ((req.body.operationName) && (req.body.operationName === "Survey")) {
          req.alias = "getSurvey"
        };
        if ((req.body.operationName) && (req.body.operationName === "GetBasemapsAndRegion")) {
          req.alias = "getBasemaps"
        };
        if ((req.body.operationName) && (req.body.operationName === "ProjectRegion")) {
          req.alias = "getProjectRegion"
        };
      });
      cy.intercept("https://api.mapbox.com/map-sessions/*").as('loadBasemaps')
      cy.intercept('https://api.mapbox.com/v4/*').as('mapboxApiEvent')
      cy.intercept("https://api.mapbox.com/styles/v1/underbluewaters/*").as("apiStyleEvent")
    })
    before(() => {
      const slug: string = generateSlug();
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
                  cy.createFormElements(formId, "Maldives", access_token).then((resp) => {
                    const SAPFormId = formId + 1
                    cy.createSAPElements(SAPFormId, "Maldives", access_token).then((resp)=> {
                      cy.wrap(resp).as('SAPResponse')
                    })
                    const formElements = resp.createFormElement.query.form.formElements
                    const jumpToIds = []
                    //atoll questions
                    const elementsToUpdate = formElements.slice(5,24)
                    //YesNo id
                    elementsToUpdate.push(formElements[30])
                    for (let i = 0; i < formElements.length; i++) {
                      if (formElements[i].typeId === "SpatialAccessPriorityInput"
                       || formElements[i].typeId === "SaveScreen"
                        ) {
                        jumpToIds.push(formElements[i].id)
                      }
                    }
                    cy.wrap(jumpToIds[1]).as('sapId')
                    cy.updateJumpToId(jumpToIds, elementsToUpdate, formId, access_token)
                    const updateSubToIdElements = []
                    formElements.forEach((t) => {
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
                    cy.get('@sapId').then((id: any) => {
                      cy.updateSubordinateToId(id, updateSubToIdElements, formId, access_token)
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
                    newIds.push(newIds[19] + 8)
                    newIds.push(newIds[20] + 1)
                    cy.createFormLogicRules(formId, "Maldives", newIds, access_token).then((resp) => {
                      cy.wrap(resp).as('createFormLogicResponse')
                    })
                    const exportIds = {
                      "tuna_gear": 0, 
                      "tuna_species": 1, 
                      "gear_ntuna": 2, 
                      "nontuna_species": 3, 
                      "recfish_type": 4, 
                      "num_of_ppl": 5, 
                      "part-time": 6, 
                      "vessel": 7, 
                      "guesthouse_name": 8,
                      "nontuna_sp": 9
                    }
                    const updateComponentSettings = (formElements) => {
                      let referenceElements = []
                      formElements.forEach((t) => {
                        //using the exportIds array, if exportId is exist, add exportId: formElement.id to referenceElements
                        if((exportIds[t.exportId]) && (t.exportId !== "tuna_gear")) {
                          referenceElements[t.exportId] = t.id
                        } else if (t.exportId === "tuna_gear") {
                          referenceElements["tuna_gear"] = t.id
                        }
                      });
                      cy.get('@sapId').then((id: any) => {
                        //sapId is the id of the SAP form element whose componentSettings need to be updated
                        cy.updateComponentSettings(id, referenceElements, access_token, formId).then((resp) => {
                          console.log(referenceElements)
                          let values: object = Object.values(resp.updateFormElement.formElement.componentSettings.childVisibilitySettings)
                          expect (values[0].enabled).to.eq(true) &&
                          expect (values[0].sectors.toString()).to.eq('Fisheries - Commercial, Tuna')
                          //expect (values[0]).to.include({enabled: true, sectors: ['Fisheries - Commercial, Tuna']})
                        });
                      });
                    };
                    let settingsElements = []
                    cy.get('@createFormLogicResponse').then((resp:any) => {
                      console.log(resp)
                      settingsElements.push(resp.createFormLogicCondition.query.form.formElements)
                    });
                    cy.get('@SAPResponse').then((resp: any) => {
                      console.log(resp)
                      console.log(settingsElements)
                      let settingsAry = settingsElements[0].concat(resp.createFormElement.query.form.formElements)
                      console.log(settingsAry)
                      updateComponentSettings(settingsAry)
                    });
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
      cy.getLocalStorage("slug").then((slug) => {
        cy.deleteProject(`${slug}`)
      })
    })
    it("Can visit the survey", () => {
      
      cy.wait('@getSurvey').its('response.statusCode').should('eq', 200)
      cy.get('.select-none').should('be.visible').then(($btn) => {
        {$btn.trigger('click')}
      });
    });
    it("Cannot advance until name is provided", () => {
      cy.contains('What is your name?')
        .get('[title = "Next Question"]')
        .should('have.class', 'pointer-events-none')
      cy.get('input').type("Test User 1") 
      cy.get('button').contains('Next').click()
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
      cy.get('[type = "button"]').contains('Next').as('nextBtn').should('be.hidden')
      cy.get('[title = "Fisheries - Commercial, Tuna"]').click()
      cy.get('[title = "Fisheries - Commercial, Non-Tuna Species"]').click()
      cy.get('[title = "Fisheries - Recreational"]').click()
      cy.get('[title = "Fisheries- Artisanal/Subsistence"]').click()
      cy.get('@nextBtn').scrollIntoView()
        .should('exist')
        .and('be.visible')
        .then(($btn) => {
           {$btn.trigger('click')}
        })
    })
    it("Can draw a polygon", () => {
      cy.get('[type = "button"]').contains('Next').as('nextBtn').then(($btn) => {
        if ($btn) {
          {$btn.trigger('click')}
        }
      })
      cy.get('@nextBtn')
        .should('not.exist')
      cy.get('h4').contains('Fisheries - Commercial, Tuna')
        .should('exist')
        .and('be.visible')
      cy.wait('@loadBasemaps').its('response.statusCode').should('eq', 200)
      drawPolygon()
    })
    it("Renders sector specific attributes - Fisheries - Commercial, Tuna", () => {
      cy.get('h1').contains('Area Name')
      cy.get(".mt-1 > .block").clear()
        .type("Yellowfin tuna fishing area.")
      cy.contains('What type of gear do you use here?')
      cy.contains('What species do you fish here')
      cy.get('[title="Pole and Line"]').click()
      cy.get('[title="Yellowfin"]').click()
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.")
      cy.contains('Save').click()
    })
    it('Can finish sector - Fisheries - Commercial, Tuna"', () => {
      cy.contains("Yellowfin tuna fishing area.")
      cy.contains("Fisheries - Commercial, Tuna")
      cy.get(".space-y-2 > :nth-child(2) > .select-none").should('be.visible').then(($el) => {
        {$el.trigger('click')}
      })
      cy.contains("Next sector").as("nextSector")
      cy.get('@nextSector').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    it('Can draw a polygon - Fisheries - Commercial, Non-Tuna Species', () => {
      cy.get('[type = "button"]').contains('Next')
        .should('not.exist')
      cy.get('h4').contains('Fisheries - Commercial, Non-Tuna Species')
        .should('exist')
        .and('be.visible')
      cy.wait('@loadBasemaps').its('response.statusCode').should('eq', 200)
      //wait for second call to route
      cy.wait('@loadBasemaps').its('response.statusCode').should('eq', 200)
      drawPolygon()
    })
    it("Renders sector specific attributes - Fisheries - Commercial, Non-Tuna Species", () => {
      cy.get('h1').contains('Area Name')
      cy.get(".mt-1 > .block").clear()
        .type("Sea cucumber fishing area.")
      cy.contains('What type of gear do you use here?')
      cy.contains('What type of species do you fish here?')
      cy.get('[title="Pole and Line"]')
        .should('not.exist')
      cy.get('[title="Pole and Line"]')
        .should('not.exist')
      cy.get('[title="Yellowfin"]')
        .should('not.exist')
      cy.get('[title="Sea cucumber"]').click()
      cy.get('[title="Jigging"]').click()
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Sea cucumber love this spot!")
      cy.contains('Save').click()
    })
    it('Can finish sector -  - Fisheries - Commercial, Non-Tuna Species', () => {
      cy.contains("Sea cucumber fishing area.")
      cy.contains("Fisheries - Commercial, Non-Tuna Species")
      //cy.get(".space-y-2 > :nth-child(2) > .select-none").should('be.visible').then(($el) => {
      //  {$el.trigger('click')}
      //})
      cy.contains("Finish Sector").as("finishSector")
      cy.get('@finishSector').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    //  cy.contains("Your sectors")
    // 
    //  cy.get("@nextQuestion").should('be.visible').then(($btn) => {
    //    {$btn.trigger('click')}
    //  })
    //})
    ////it("Skips to end when answer to additional questions is no", () => {
    ////  cy.contains('Are you willing to answer a few additional questions about who you are?')
    ////    .should('be.visible')
    ////  cy.get('[title="No"]')
    ////    .contains('No')
    ////    .should('be.visible')
    //    .click()
    //  cy.wait('@createResponse').its('response.statusCode').should('eq', 200)
    //  cy.get('h1').contains('Thank You for Responding').should('be.visible')
    //  cy.restoreLocalStorage()
    //  cy.getLocalStorage('surveyId').then((id) => {
    //    cy.getLocalStorage('slug').then((slug) => {
    //      cy.visit(Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`)
    //    })
    //  })
    //})
    //it("Can answer additional questions", () => {
    //  cy.restoreLocalStorage()
    //  cy.getLocalStorage('surveyId').then((id) => {
    //    cy.getLocalStorage('slug').then((slug) => {
    //      cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`)
    //    })
    //    
    //  })
    //  cy.get('h1').contains('Are you willing to answer a few additional questions about who you are?')
    //  cy.contains('Yes').click()
    //})
    //it("Can input age", () => {
    //  cy.contains("Your age")
    //  cy.get('input').clear().type("30")
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
    //        const sketchId = (ary[4].collection[0])-1
    //        expect(ary.length).to.eq(9)
    //        expect (ary[0].name).to.eq('Test User 1')
    //        expect (ary[1]).to.eq('test_user_1@seasketch.org')
    //        expect (ary[2][0]).to.eq('N')
    //        expect (ary[3][0]).to.eq('Kudafari')
    //        expect (ary[4].sectors[0]).to.equal("Fisheries - Commercial, Tuna")
    //        expect (ary[5]).to.eq(true)
    //        expect (ary[6]).to.eq(30)
    //        expect (ary[7][0]).to.eq('Female')
    //        expect (ary[8]).to.eq("My general comments.")
    //        cy.restoreLocalStorage()
    //        //cy.getLocalStorage('token').then((token) => {
    //        //  console.log(token)
    //        //  cy.deleteSketch(sketchId, token).then((resp)=> {
    //        //    
    //        //    console.log(resp)
    //        //  })
    //        //})
    //      })
    //    })
    //  })
    //})
  })
  describe("Visual testing", () => {
    describe("Testing for key elements on mobile devices", () => {
      beforeEach(() => {
        cy.intercept("http://localhost:3857/graphql", (req) => {
          if ((req.body.operationName) && (req.body.operationName === "CreateResponse")) {
            req.alias = "createResponse"
          };
          if ((req.body.operationName) && (req.body.operationName === "Survey")) {
            req.alias = "getSurvey"
          };
          if ((req.body.operationName) && (req.body.operationName === "GetBasemapsAndRegion")) {
            req.alias = "getBasemaps"
          };
          if ((req.body.operationName) && (req.body.operationName === "ProjectRegion")) {
            req.alias = "getProjectRegion"
          };
        });
        cy.intercept("https://api.mapbox.com/map-sessions/*").as('loadBasemaps')
        cy.intercept('https://api.mapbox.com/v4/*').as('mapboxApiEvent')
        cy.intercept("https://api.mapbox.com/styles/v1/underbluewaters/*").as("apiStyleEvent")
      }) 
      before(() => {
        const slug: string = generateSlug();
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
                    cy.createFormElements(formId, "Maldives", access_token).then((resp) => {
                      const SAPFormId = formId + 1
                      cy.createSAPElements(SAPFormId, "Maldives", access_token)
                      const formElements = resp.createFormElement.query.form.formElements
                      const jumpToIds = []
                      //atoll questions
                      const elementsToUpdate = formElements.slice(5,24)
                      //YesNo id
                      elementsToUpdate.push(formElements[30])
                      for (let i = 0; i < formElements.length; i++) {
                        if (formElements[i].typeId === "SpatialAccessPriorityInput"
                         || formElements[i].typeId === "SaveScreen"
                          ) {
                          jumpToIds.push(formElements[i].id)
                        }
                      }
                      const sapId = jumpToIds[1]
                      cy.updateJumpToId(jumpToIds, elementsToUpdate, formId, access_token)
                      const updateSubToIdElements = []
                      formElements.forEach((t) => {
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
                       cy.updateSubordinateToId(sapId, updateSubToIdElements, formId, access_token)
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
                        newIds.push(newIds[19] + 8)
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
      it('Can visit the survey', () => {
        cy.wait('@getSurvey').its('response.statusCode').should('eq', 200)
      })
      devices.forEach((device) => {
        it(`Renders survey homepage correctly -${device}`, () => {
          cy.viewport(device);
          cy.get('h1').contains('Welcome Ocean Users!');
          cy.get('button').contains('Language')
            .and('be.visible');
          cy.get('button').contains('Settings')
            .and('be.visible');
       })
       it(`Can view settings options -${device}`, () => {
        cy.viewport(device);
        cy.get('button').contains('Settings')
          .should('be.visible')
          .then(($btn) => {
            {$btn.trigger('click')}
          });
        //***settings button not always visible */
        cy.get('span').contains('Facilitated Response');
        cy.get('span').contains('Practice Mode');
        //cy.get('span.inline-flex').as('switches')
        //let toggle
        //let toggled
        //const setToggle = () => {
        //  if (toggle === false) {
        //    toggle = true
        //  } else {
        //    toggle = false
        //  }
        //}
        //cy.get('@switches').each(($switch) => {
        //
        //    
        //    {$switch.trigger('click')}
        //    setToggle()
        //    if (toggle) {
        //      expect ($switch).to.have.css('background-color', 'rgb(46, 115, 182)' )
        //    } else {
        //      expect ($switch).to.have.css('background-color', 'rgba(0, 0, 0, 0.18)')
        //    }
        //  
        //})
       //
      })
    })
      //it (`Can view language options - ${device}`, () => {
      //  cy.get('div.absolute.inset-0').then((el) => {
      //    //cy.screenshot({
      //    //  capture: "viewport",
      //    //});
      //    if (el) {
      //      el.trigger('click')
      //      //cy.get('.fixed.z-50').click()
      //    } else {
      //      cy.get('.fixed.z-50').click()
      //    }
      //  });
      //  cy.get('button').contains('Language', {timeout:10000}).click();
      //  cy.get('span').contains('DV')
      //    .should('exist')
      //    .and('be.visible');
      //  cy.get('span').contains('EN')
      //    .should('exist')
      //    .and('be.visible') 
      //    .click();
      //  });
      //});
      //it('Proceeds to name input page', () => {
      //  cy.get('button').contains('Begin').click()
      //})
      //devices.forEach((device) => {
      //  it(`Renders name input page properly - ${device}`, () => {
      //    cy.viewport(device);
      //     //**"What is your name" is not always visible */ .should('be.visible ')
      //     //this is problematic on iphone-x, iphone-5
      //    cy.contains('What is your name?')
      //    //*** */
      //    cy.get('[name*="-name-input"]')
      //      .should('be.visible')
      //      .type('Test User 1');
      //    cy.get('[name*="-name-input"]').then((input) => {
      //      expect (input.val()).to.match(/Test User 1/)
      //    })
      //    checkForNavAndLang()
      //  });
      //}); 
      //it('Proceeds to email input page', () => {
      //  cy.get('[data-cy^="button-"]').click()
      //});
      //devices.forEach((device) => {
      //  it(`Renders the email input page properly - ${device}`, () => {
      //    cy.viewport(device); 
      //    cy.contains("What is your email address?")
      //    cy.get(('[data-cy*="-skip-question"]'))
      //      .should('be.visible')
      //    cy.get('[name*="-email-input"]')
      //      .should('be.visible')
      //      .type('test_user_1@seasketch.org')
      //      .then((input) => {
      //        expect (input.val()).to.match(/test_user_1@seasketch.org/)
      //      })
      //    cy.get('[name*="-email-input"]').clear()
      //    checkForNavAndLang()
      //  });
      //});
      //it('Proceeds to atoll selection page', () => {
      //  cy.get('[data-cy^="button-"]').should('be.visible')
      //    .click()
      //})
      //devices.forEach((device) => {
      //  it(`Renders atoll selection page properly - ${device}`, () => {
      //    cy.viewport(device);
      //    //this has an issue with iphone-x
      //    cy.contains("Which Atoll do you reside on?")
      //    cy.get('[title="HA"]').siblings().then(($atolls) => {
      //      //these have a visbility issue with iphone-x
      //      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      //      expect($atolls).to.exist
      //      expect(($atolls).length).to.eq(19)
      //    })
      //    checkForNavAndLang()
      //  });
      //});
      //it ('Proceeds to island selection page', () => {
      //  cy.get('[title="HA"]').click()
      //});
      //devices.forEach((device) => {
      //  it(`Renders island selection page properly - ${device}`, () => {
      //    cy.viewport(device);
      //    //this has an issue with iphone-x
      //    cy.contains("Which island of HA atoll do you reside on?")
      //    cy.get('[title="Thuraakunu"]').siblings().then(($islands) => {
      //      //these have a visbility issue with iphone-x
      //      //expect($islands).to.be.visible
      //      expect(($islands).length).to.eq(15)
      //    })
      //    checkForNavAndLang()
      //  });
      //});
      it ('Proceeds to sector selection page', () => {
        cy.restoreLocalStorage()
        cy.getLocalStorage('surveyId').then((id) => {
          cy.getLocalStorage('slug').then((slug) => {
            cy.visit(`${slug}/surveys/${id}/23`)
          })
        })
        //cy.get('[title="Thuraakunu"]').click()
      })
      
      devices.forEach((device) => {
        it(`Renders sector selection page properly - ${device}`, () => {
          cy.viewport(device);
          //this has an issue with iphone-x
          cy.contains("What sectors do you represent?")
          //cy.get('button').contains("Fisheries - Commercial, Tuna")
          cy.get('[title="Fisheries - Commercial, Tuna"]')
            .should('be.visible')

            .siblings().then(($sectors) => {
               expect($sectors).to.exist
               expect(($sectors).length).to.eq(15)
              });
            //these have a visbility issue with iphone-x
         
            //expect($sectors).to.be.visible
            
          //})
            checkForNavAndLang()
        });
      });
    });
    it ('Proceeds to spatial access priority page', () => {
      //fail to fetch issue
      cy.get('[title="Shipping"]').click()
      cy.get('button').contains('Next').scrollIntoView().click()
    });
      //it("Renders spatial access priority page properly", () => {
      //  cy.wait('@loadBasemaps').its('response.statusCode').should('eq', 200)
      //  //drawPolygon()
      //})

  });//
});//
//
//only
//data-cy
//get through survey
//abstract
//azores
