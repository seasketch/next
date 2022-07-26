/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { verify } from "crypto";

let surveyId: any;

const FormData = require('form-data');
const fetch = require('node-fetch');

const basemapNames = ["Maldives Light", "Satellite"];

const basemaps = {
  "Maldives Light": {
    "name": "Maldives Light", 
    "type": "MAPBOX", 
    "url": "mapbox://styles/seasketch/ckxywn6wm4r2h14qm9ufcu23w"
  },
  "Satellite": {
    "name": "Satellite", 
    "type": "MAPBOX", 
    "url": "mapbox://styles/mapbox/satellite-streets-v11"
  }
};

const createBasemaps = (id, token, name) => {
  const body = new FormData();
    body.append(
      'operations',
      JSON.stringify({
        query: /* GraphQL */ `
          mutation CypressCreateBasemap($input: CreateBasemapInput!) {
            createBasemap(input: $input) {
              basemap {
                id, 
                name, 
                url,
                projectId
              }
              
            }
          }
        `,
        variables: {
          input: {
            basemap: {
              projectId: id,
              name: basemaps[name].name,
              type: basemaps[name].type,
              url: basemaps[name].url,
              thumbnail: null
            }
          }
        }
      })
    );
  const file = new File(["basemap_thumbnail"], "basemap_thumbnail.jpg", {
    type: "image/jpeg",
  });
  body.append('map', JSON.stringify({ 1: ['variables.input.basemap.thumbnail'] }));
  body.append('1', file);
  //var xhr = new XMLHttpRequest;
  //xhr.open('POST', 'http://localhost:3857/graphql', true);
  //xhr.send(body);
  const fetchResponse = fetch(
    'http://localhost:3857/graphql', 
    { method: 'POST', 
    headers: {
      'Authorization': `Bearer ${token}`,
    }, body })
  return fetchResponse
};

const waitOnMapbox = (count) => {
  for (; count; count--) {
    cy.wait('@mapboxApiCall').then((intercepts) => {
      expect (intercepts.response.statusCode).to.be.oneOf([200, 204]);
    });
  };
};

const generateSlug = () => { 
  const result = Math.random().toString(36).substring(2,7);
  return result
};

const checkForNavAndLang = () => {
  //navigation and language buttons
  cy.get('[title="Previous Question"]').should('be.visible').and('exist');
  cy.get('[title="Next Question"]').should('be.visible').and('exist');
  cy.get('button.px-3')
    .should('be.visible');
};

const drawPolygon = () => {
  cy.get('.mapboxgl-canvas').each((t) => {
    expect (t).to.exist
    const canvases = [];
    canvases.push(t);
    return canvases
  }).then((ary) => {
    const el = ary[0]
    return el
  }).as('el');
  cy.get('@el').click(100,100)     
    .click(50, 100)
    .click(50, 50)
    .click(100, 50)
    .dblclick(100, 100)
};

const drawInvalidPolygon = () => {
  cy.get('.mapboxgl-canvas').each((t) => {
    expect (t).to.exist
    const canvases = [];
    canvases.push(t);
    return canvases
  }).then((ary) => {
    const el = ary[0]
    return el
  }).as('el');
  cy.get('@el').click(100, 200)        
    .click(100, 100)
    .click(200, 200)
    .click(50, 200)
    .dblclick(100, 200)
};

const drawSecondPolygon = () => {
  cy.get('.mapboxgl-canvas').each((t) => {
    expect (t).to.exist
    const canvases = [];
    canvases.push(t);
    return canvases
  }).then((ary) => {
    const el = ary[0]
    return el
  }).as('el');
  cy.get('@el').click(100,100)     
    .click(50, 100)
    .click(50, 50)
    .click(100, 50)
    .dblclick(100, 100)
};

const devices: any = ["macbook-15"]//, "ipad-2", "iphone-x"]

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
        if ((req.body.operationName) && (req.body.operationName === "ProjectMetadata")) {
          req.alias = "getProjectMetadata"
        }
      });
      cy.intercept(/mapbox/).as('mapboxApiCall'); 
    });
    before(() => {
      const slug: string = generateSlug();
      cy.setLocalStorage("slug", slug);
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
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
              basemapNames.forEach((t) => {
                createBasemaps(projectId, access_token, t)
              });
              cy.setLocalStorage("surveyId", resp.makeSurvey.survey.id);
              cy.setLocalStorage("access_token", access_token);
              cy.wrap(resp.makeSurvey.survey.form.id).as('formId');
              cy.wrap(resp.makeSurvey.survey.form.formElements).as('formElements');
              cy.wrap(resp.makeSurvey.survey.id).as('surveyId');
              cy.updateSurvey(resp.makeSurvey.survey.id, access_token);
              cy.get('@formId').then((formId: any) => {
                cy.deleteFormElements(formId, access_token).then((resp) => {
                  const elementsToUpdate = []
                  resp.deleteFormElement.query.form.formElements.forEach(t => {
                    elementsToUpdate.push(t);
                  });
                  cy.updateFormElements(elementsToUpdate,"Maldives", access_token, formId);
                  cy.createFormElements(formId, "Maldives", access_token).then((resp) => {
                    const SAPFormId = formId + 1
                    cy.createSAPElements(SAPFormId, "Maldives", access_token).then((resp)=> {
                      cy.wrap(resp).as('SAPResponse');
                      let SAPElements = resp.createFormElement.query.form.formElements
                      cy.setLocalStorage('SAPElements', JSON.stringify(SAPElements));
                    })
                    const formElements = resp.createFormElement.query.form.formElements
                    const jumpToIds = []
                    //atoll questions
                    const elementsToUpdate = formElements.slice(5,24);
                    //YesNo id
                    elementsToUpdate.push(formElements[30]);
                    for (let i = 0; i < formElements.length; i++) {
                      if (formElements[i].typeId === "SpatialAccessPriorityInput"
                       || formElements[i].typeId === "SaveScreen"
                        ) {
                        jumpToIds.push(formElements[i].id);
                      };
                    };
                    cy.wrap(jumpToIds[1]).as('sapId');
                    cy.updateJumpToId(jumpToIds, elementsToUpdate, formId, access_token);
                    const updateSubToIdElements = [];
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
                    });
                    cy.get('@sapId').then((id: any) => {
                      cy.updateSubordinateToId(id, updateSubToIdElements, formId, access_token);
                    });
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
                        };
                        getIds(baseId);
                      } else {
                        for(let i=0; i < 20; i++) {
                          ids.push(baseId++);
                        };
                      };
                      return ids
                    };
                    let newIds = getIds(baseId);
                    newIds.push(newIds[19] + 8);
                    newIds.push(newIds[20] + 1);
                    cy.createFormLogicRules(formId, "Maldives", newIds, access_token).then((resp) => {
                      cy.wrap(resp).as('createFormLogicResponse');
                    });
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
                    };
                    const updateComponentSettings = (formElements) => {
                      let referenceElements = [];
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
                          let values: object = Object.values(resp.updateFormElement.formElement.componentSettings.childVisibilitySettings)
                          expect (values[0].enabled).to.eq(true) &&
                          expect (values[0].sectors.toString()).to.eq('Fisheries - Commercial, Tuna')
                          //expect (values[0]).to.include({enabled: true, sectors: ['Fisheries - Commercial, Tuna']})
                        });
                      });
                    };
                    let settingsElements = []
                    cy.get('@createFormLogicResponse').then((resp:any) => {
                      settingsElements.push(resp.createFormLogicCondition.query.form.formElements)
                    });
                    cy.get('@SAPResponse').then((resp: any) => {
                      let settingsAry = settingsElements[0].concat(resp.createFormElement.query.form.formElements)
                      updateComponentSettings(settingsAry)
                    });
                    cy.saveLocalStorage()
                  })
                })
              })
            })
          });
        });
        cy.get("@surveyId").then((id) => {
        cy.visit(`${slug}/surveys/${id}`)
        //cy.wait('@getSurvey').its('response.statusCode').should('eq', 200)
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
    devices.forEach((device) => {
      it(`Can visit the survey - ${device}`, () => {
        cy.viewport(device);
        if (device === "macbook-15") {
          cy.wait('@getSurvey').its('response.statusCode').should('eq', 200);
        }
      });
      it(`Can view and toggle settings - ${device}`, () => {
        cy.viewport(device)
        cy.get('button').contains('Settings')
          .should('be.visible')
          .then(($btn) => {
            {$btn.trigger('click')}
          });
        cy.get('span').contains('Facilitated Response');
        cy.get('span').contains('Practice Mode');
        cy.get('[role="switch"]').as('switches')
        cy.get('@switches').each(($switch) => {
          expect ($switch.attr('aria-checked')).to.equal(`false`)
          {$switch.trigger('click')}
          //setToggle($switch)
          expect ($switch.attr('aria-checked')).to.equal(`true`)
          {$switch.trigger('click')}
        });
        cy.get('body').click('bottom');
        cy.get('[role="dialog"]')
          .should('not.exist')
        cy.get('[name="Begin Survey"]').should('be.visible').then(($btn) => {
          {$btn.trigger('click')}
        });
      });
      it(`Cannot advance until name is provided - ${device}`, () => {
        cy.viewport(device)
        //checkForNavAndLang()
        cy.contains('What is your name?')
          .get('[title = "Next Question"]')
          .should('have.class', 'pointer-events-none')
        cy.get('input').type("Test User 1") 
        cy.get('button').contains('Next').click()
      });
      it(`Can input email address or can skip question - ${device}`, () => {
        cy.viewport(device)
        //checkForNavAndLang()
        cy.contains("What is your email address?")
        cy.get("input").should('be.visible')
        cy.get("input")
          .type("test_user_1@seasketch.org")
        cy.contains("Next").click()
      });
      it(`Cannot advance until atoll selection is made - ${device}`, () => {
        cy.viewport(device)
        //checkForNavAndLang()
        cy.contains("Which Atoll do you reside on?")
          .get('[title = "Next Question"]')
          .should('have.class', "pointer-events-none")
        cy.contains('N').click()
      });
      it(`Cannot advance until island selection is made - ${device}`, () => {
        cy.viewport(device)
        //checkForNavAndLang()
        cy.restoreLocalStorage()
        cy.getLocalStorage('slug').then((slug) => {
          cy.getLocalStorage("surveyId").then((id) => {
            cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/7/`);
          })
        })
        cy.contains("Which Atoll do you reside on?")
          .should('not.exist')
        cy.contains('Which island of N atoll do you reside on?')
        cy.contains('Lhohi')
        cy.get('[title = "Next Question"]')
          .should('have.class', "pointer-events-none")
        cy.contains('Kudafari').click()
      });
      it(`Cannot advance until sector selection(s) is made - ${device}`, () => {
        cy.viewport(device)
        //checkForNavAndLang()
        cy.get('[type = "button"]').contains('Next').as('nextBtn').should('be.hidden')
        cy.get('[title = "Fisheries - Commercial, Tuna"]').click()
        cy.get('[title = "Fisheries - Commercial, Non-Tuna Species"]').click()
        //cy.get('[title = "Fisheries - Recreational"]').click()
        //cy.get('[title = "Fisheries- Artisanal/Subsistence"]').click()
        cy.get('@nextBtn').scrollIntoView()
          .should('exist')
          .and('be.visible')
          .then(($btn) => {
             {$btn.trigger('click')}
          });
      });
      it(`Can draw a polygon - Fisheries - Commercial, Tuna - ${device}`, () => {
        cy.viewport(device);
        cy.get('[title = "Fisheries - Commercial, Tuna"]')
          .should('not.exist');
        cy.get('button').contains('Next')
          .should('not.exist');
        cy.get('h4').contains('Fisheries - Commercial, Tuna')
          .should('exist')
          .and('be.visible');
        cy.window().its('mapContext.basemaps').then((maps) => {
          Object.keys(maps).forEach((key) => {
            expect (basemaps[maps[key].name]).to.exist
          });
        });
        if (device === "iphone-x" || device === "iphone-5") {
          Cypress.on('uncaught:exception', (err, runnable) => {
            if (err) {
              cy.log(`${err}`)
              return false
            }
          });
        }
        //polygon path for mobile devices
        if (device === "iphone-x" || device === "iphone-5") {
          cy.get('[data-cy="button-begin"]')
            .should('exist')
            .and('be.visible')
            .as('beginBtn');
          cy.get('@beginBtn').then(($btn) => {
            {$btn.trigger('click')}
          });
          waitOnMapbox(5);
          cy.get('[role="progressbar"]')
            .should('not.exist');
          drawPolygon();
        } else {
          if (device === "macbook-15") {
            waitOnMapbox(9);
            cy.get('div.MapPicker')
              .should('exist')
              .and('be.visible');
            cy.get('[role="progressbar"]')
              .should('not.exist');
            drawPolygon();
          } else {
            cy.get('div.MapPicker')
              .should('exist')
              .and('be.visible')
            cy.get('[role="progressbar"]').then((progressBar) => {
              if (progressBar.children().hasClass('animate-spin')) {
                cy.wait(500);
                cy.get('[role="progressbar"]').should('not.have.class', 'animate-spin')
              }
            });
            waitOnMapbox(3);
            cy.get('[role="progressbar"]')
              .should('not.exist');
            drawPolygon();
          }
        }
      });
      it(`Renders sector specific attributes - Fisheries - Commercial, Tuna - ${device}`, () => {
        cy.viewport(device); 
        if (device === "iphone-5" || device === "iphone-x") {
          cy.get('[data-cy="button-done"]')
            .should('exist')
            .and('be.visible')
          cy.get('button').then((btn) => {
            if(btn.text().includes('Done')) {
              cy.get('button').contains('Done').click()
            }
          });
        }
        cy.get('h1').contains('Area Name')
          .should('exist')
          .and('be.visible');
        cy.get(".mt-1 > .block").scrollIntoView().clear()
          .type("Yellowfin tuna fishing area.");
        cy.contains('What type of gear do you use here?');
        cy.contains('What species do you fish here');
        cy.get('[title="Pole and Line"]')
          .should('be.visible')
        cy.get('[title="Yellowfin"]').click();
        cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.");
      });
      it (`Can set area importance using SAP range slider - ${device}`, () => {
        cy.viewport(device)
        cy.get('h1').contains('How important is this area?').scrollIntoView();
        cy.get('input[type=range]').as('range')
          .should('exist');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        cy.get('@range').then(($range) => {
          // get the DOM node
          const range = $range[0];
          // set the value manually
          nativeInputValueSetter.call(range, 0);
          // dispatch the event
          //@ts-ignore
          range.dispatchEvent(new Event('change', { value: 5, bubbles: true }));
        });
        cy.get('@range')
          .should('have.value', 0);
        cy.get('button').contains('Save').then(($save) => {
          {$save.trigger('click')}
        });
        cy.get('button').contains('Yellowfin')
          .should('not.exist')
        cy.get('button').contains('Save')
          .should('not.exist')
        cy.get('.SAPRangeMini')
          .should('exist')
          .and('be.visible')
          .and('have.value', 0);
      });
      //it(`Can finish sector - Fisheries - Commercial, Tuna - ${device}`, () => {
      //  cy.viewport(device); 
      //  cy.contains('Fisheries - Commercial, Tuna')
      //    .should('be.visible');
      //  cy.contains("Yellowfin tuna fishing area.");
      //  if (device === "iphone-x") {
      //    cy.get('button').contains('New Shape')
      //      .should('be.visible')
      //    cy.contains('View Map')
      //      .should('be.visible')
      //  }
      //  cy.get("button").contains('Finish Sector').as('finishSector').should('be.visible').then(($el) => {
      //    {$el.trigger('click')}
      //  });
      //  cy.get('@finishSector')
      //    .should('not.exist')
      //  cy.get('h1').contains('Your sectors')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('.space-y-2')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('button').contains('Next sector').as('nextSectorBtn')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('@nextSectorBtn').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      // });
      });
    });
  });