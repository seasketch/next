/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { verify } from "crypto";
import { callbackify } from "util";
//import "cypress-real-events"

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
  console.log('drawpoly')
  cy.get('.mapboxgl-canvas').each((t) => {
    console.log('canvas')
    console.log(t)
    expect (t).to.exist
    const canvases = [];
    canvases.push(t);
    return canvases
  }).then((ary) => {
    console.log('canvasAry')
    const el = ary[0]
    return el
  }).as('el');
  console.log('draw')
  cy.get('@el').click(300,300)     
    .click(300, 100)
    .dblclick(200, 400);
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

const devices: any = ["macbook-15"]//"macbook-15", "ipad-2", "iphone-x"]//, ]//, "ipad-2", "iphone-x"]

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
        cy.visit(`${slug}/surveys/${id}`);
        cy.get('[role="progressbar"]')
          .should('not.exist');
        cy.contains('Begin')
          .should('be.visible')
        cy.contains('Welcome')
          .should('be.visible')
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
        cy.getLocalStorage("token").then((token) => {
          cy.deleteSurvey(surveyId, token)
        })
      })
      //cy.getLocalStorage("slug").then((slug) => {
      //  cy.deleteProject(`${slug}`)
      //})
    })
    devices.forEach((device) => {
      it(`Can visit the survey - ${device}`, () => {
        cy.viewport(device);
        //if (device === "macbook-15") {
        //  cy.wait('@getSurvey').its('response.statusCode').should('eq', 200);
        //}
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
        cy.viewport(device);
        checkForNavAndLang();
        cy.contains('What is your name?')
          .get('[title = "Next Question"]')
          .should('have.class', 'pointer-events-none')
        cy.get('input').type("Test User 1") 
        cy.get('button').contains('Next').click()
      })
      it(`Can input email address or can skip question - ${device}`, () => {
        cy.viewport(device);
        checkForNavAndLang();
        cy.contains("What is your email address?")
        cy.get("input").should('be.visible')
        cy.get("input")
          .type("test_user_1@seasketch.org")
        cy.contains("Next").click()
      })
      it(`Cannot advance until atoll selection is made - ${device}`, () => {
        cy.viewport(device);
        checkForNavAndLang();
        cy.contains("Which Atoll do you reside on?")
          .get('[title = "Next Question"]')
          .should('have.class', "pointer-events-none")
        cy.contains('N').click()
      });
      it(`Cannot advance until island selection is made - ${device}`, () => {
        cy.viewport(device);
        checkForNavAndLang();
        cy.restoreLocalStorage();
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
      })
      it(`Cannot advance until sector selection(s) is made - ${device}`, () => {
        cy.viewport(device);
        checkForNavAndLang();
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
        cy.log('Checking mapContext readiness')
        cy.window().its('mapContext').then((mapContext) => {
          const maps = mapContext.basemaps
          expect (mapContext.internalState.ready).to.eq(true)
          Object.keys(maps).forEach((key) => {
            expect (basemaps[maps[key].name]).to.exist
          });
        });
        Cypress.on('uncaught:exception', (err, runnable) => {
          if (err) {
            cy.log(`${err}`)
            return false
          }
        });
        //polygon path for mobile devices
        if (device === "iphone-x") {
          cy.get('[data-cy="button-begin"]')
            .should('exist')
            .and('be.visible')
            .as('beginBtn');
          cy.get('@beginBtn').then(($btn) => {
            {$btn.trigger('click')}
          });
          waitOnMapbox(6);
          cy.get('span.mapboxgl-ctrl-icon')
            .should('be.visible')
          drawPolygon();
        } else {
          if (device === "macbook-15") {
            cy.contains('Fisheries')
              .should('be.visible');
            waitOnMapbox(8)
            cy.get('span.mapboxgl-ctrl-icon')
              .should('be.visible');
            cy.get('div.MapPicker')
              .and('be.visible');
            cy.wait(5000);
            drawPolygon();
          } else {
            cy.contains('Fisheries')
              .should('be.visible')
            cy.get('span.mapboxgl-ctrl-icon')
              .should('be.visible')
            cy.get('div.MapPicker')
              .should('exist')
              .and('be.visible')
            //cy.get('[role="progressbar"]').then((progressBar) => {
            //  if (progressBar.children().hasClass('animate-spin')) {
            //    cy.get('[role="progressbar"]').should('not.have.class', 'animate-spin')
            //  }
            //});
            waitOnMapbox(3);
            //cy.get('[role="progressbar"]')
            // .should('not.exist');
            drawPolygon();
          }
        }
      });
      it(`Can view basemap selector - ${device}`, () => {
        cy.viewport(device);
        cy.get('img').click();
        let values = ['Reset view', 'Focus on location', 'Show scale bar', 'Basemap', 'Maldives Light', 'Satellite']
        values.forEach((val) => {
          cy.get('.fixed > .overflow-y-auto').children().contains(val);
        });
        cy.get('img[alt="Satellite basemap"]')
          .should('be.visible');
        cy.get('img[alt="Maldives Light basemap"]')
          .should('be.visible');
      });
      //it (`Can show scale bar - ${device}`, () => {
      //  cy.viewport(device);
      //  cy.get('h4').contains('Show scale bar');
      //  cy.get('[role="switch"]').as('scaleSwitch').then(($switch) => {
      //    expect ($switch.attr('aria-checked')).to.equal(`false`);
      //    {$switch.trigger('click')}
      //  })
      //  cy.get('@scaleSwitch').then(($switch) => {
      //    expect ($switch.attr('aria-checked')).to.equal(`true`);
      //  });
      //  if (device !== "iphone-x") {
      //    cy.get('.mapboxgl-ctrl-scale')
      //      .contains('5,000')
      //      .should('be.visible');
      //  } else {
      //    cy.get('.mapboxgl-ctrl-scale')
      //      .contains('10000')
      //      .should('be.visible');
      //  }
      //  
      //    
      //    //.as("scaleBar").then((scaleBar) => {
      //    //  cy.setLocalStorage("scale bar", scaleBar.html())
      //    //  cy.saveLocalStorage()
      //    //})
      //});
      //it (`Renders the correct basemap - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.contains('Maldives Light').as('maldivesLightBasemap')
      //  cy.get('@maldivesLightBasemap').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //  cy.get('@maldivesLightBasemap').should('have.class', 'font-semibold')
      //  cy.contains('Satellite')
      //    .should('not.have.class', 'font-semibold')
      //})
      //it (`Can select different basemap - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.contains('Satellite').as('satelliteBasemap')
      //    cy.get('@satelliteBasemap').then(($btn) => {
      //      {$btn.trigger('click')}
      //    })
      //    .should('have.class', 'font-semibold')   
      //  cy.contains('Maldives Light')
      //    .should('not.have.class', 'font-semibold')
      //})
      //it(`Shows option to focus on location - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.restoreLocalStorage()
      //  cy.getLocalStorage("surveyId").then((id) => {
      //    cy.setLocalStorage("surveyId", id)
      //  });
      //  cy.window().its('mapContext.map.transform._center').as('centerCoords').then((center) => {
      //    cy.setLocalStorage("lat", `${center["lat"]}`)
      //    cy.setLocalStorage("long", `${center["lng"]}`)
      //    
      //    cy.saveLocalStorage();
      //    cy.get('h4').contains('Focus on location').click();
      //  });
      //});
      //it(`Focuses on location - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.restoreLocalStorage()
      //  cy.getLocalStorage('lat').then((lat) => {
      //    cy.getLocalStorage('long').then((lng) => {
      //      cy.window().its('mapContext.map.transform._center').then((coords) => {
      //        expect (coords["lat"]).to.not.equal(lat)
      //        expect (coords["lng"]).to.not.equal(lng)
      //      });
      //    });
      //  });
      //  cy.getLocalStorage("surveyId").then((id) => {
      //    cy.setLocalStorage("surveyId", id)
      //  });
      //  //cy.getLocalStorage("scale bar").then((unfocusedScale) => {
      //  //  cy.get('.mapboxgl-ctrl-scale')
      //  //    .should('be.visible')
      //  //    .then((focusedScale) => {
      //  //      expect (focusedScale.html()).to.not.equal(unfocusedScale)
      //  //  })
      //  //})
      //});
      //it(`Renders sector specific attributes - Fisheries - Commercial, Tuna - ${device}`, () => {
      //  cy.viewport(device); 
      //  cy.get('img').then((imgs) => {
      //    imgs[0].click()
      //  });
      //  if (device === "iphone-5" || device === "iphone-x") {
      //    cy.get('[data-cy="button-done"]')
      //      .should('exist')
      //      .and('be.visible')
      //      .as('doneBtn')
      //      //.click()
      //      //cy.get('@doneBtn').then(($btn) => {
      //      //  {$btn.trigger('click')}
      //      //})
      //    cy.get('button').then((btn) => {
      //      if(btn.text().includes('Done')) {
      //        cy.get('button').contains('Done').click()
      //      }
      //    });
      //  }
      //  cy.get('h1').contains('Area Name')
      //    .should('exist')
      //    .and('be.visible');
      //  cy.get(".mt-1 > .block").scrollIntoView().clear()
      //    .type("Yellowfin tuna fishing area.");
      //  cy.contains('What type of gear do you use here?');
      //  cy.contains('What species do you fish here');
      //  cy.get('[title="Pole and Line"]').click();
      //  cy.get('[title="Yellowfin"]').click();
      //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.");
      //});
      //it (`Can set area importance using SAP range slider - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.get('h1').contains('How important is this area?').scrollIntoView();
      //  cy.get('input[type=range]').as('range')
      //    .should('exist');
      //  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      //  cy.get('@range').then(($range) => {
      //    // get the DOM node
      //    const range = $range[0];
      //    // set the value manually
      //    nativeInputValueSetter.call(range, 15);
      //    // dispatch the event
      //    //@ts-ignore
      //    range.dispatchEvent(new Event('change', { value: 15, bubbles: true }));
      //  });
      //  cy.get('@range')
      //    .should('have.value', 15);
      //  cy.get('button').contains('Save').then(($save) => {
      //    {$save.trigger('click')}
      //  });
      //  cy.get('button').then((button) => {
      //    if(button.text().includes('Save')) {
      //      cy.get('button').contains('Save').then(($btn) => {
      //        {$btn.trigger('click')}
      //      })
      //    }
      //    
      //  })
      //  //cy.get('button').contains('Save')
      //  //  .should('not.exist')
      //  cy.get('.SAPRangeMini')
      //    .should('exist')
      //    .and('be.visible')
      //    .and('have.value', 15);
      //});
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
      // 
      //});
      ////it(`Can draw a polygon - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      ////  cy.viewport(device); 
      ////  cy.get('button').contains('Next sector')
      ////    .should('not.exist')
      ////  if (device === "iphone-x" || device === "iphone-5") {
      ////    Cypress.on('uncaught:exception', (err, runnable) => {
      ////      // returning false here prevents Cypress from
      ////      // failing the test
      ////      if (err) {
      ////        cy.log(`${err}`)
      ////        return false
      //      }
      //    })
      //    cy.get('[data-cy="button-begin"]')
      //      .should('exist')
      //      .and('be.visible')
      //      .as('beginBtn').then(($btn) => {
      //        {$btn.trigger('click')}
      //      })
      //    cy.get('[data-cy="button-begin"]')
      //      .should('not.be.visible')
      //    cy.get('p').contains('Click on the map')
      //      .should('exist')
      //      .and('be.visible');
      //    cy.get('[role="progressbar"]')
      //      .should('not.exist')
      //    drawPolygon()
      //    cy.get('[data-cy="button-done"]').as('doneBtn')
      //      .should('exist')
      //      .and('be.visible')
      //      .click()
      //  } else {
      //    waitOnMapbox(5)
      //    cy.get('[role="progressbar"]')
      //      .should('not.exist')
      //    cy.get('h4').contains('Fisheries - Commercial, Non-Tuna Species')
      //      .should('exist')
      //      .and('be.visible')
      //    drawPolygon()
      //  }
      //})//;
      //it(`Renders sector specific attributes - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device); 
      //  cy.get('button').then(($button) => {
      //    if ($button.text().includes('Done')) {
      //      cy.get('button').contains('Done').then(($btn) => {
      //        {$btn.trigger('click')}
      //      });
      //    }
      //  });
      //  cy.get('button').contains('Done')
      //    .should('not.exist')
      //  if (device === "iphone-5" || device ==="iphone-x") {
      //    cy.get('.mapboxgl-ctrl-scale')
      //    //.should('not.exist')
      //    .should('not.be.visible')
      //    cy.contains('Fisheries')
      //      .should('not.exist')
      //  //cy.get('img[alt="Satellite map preview')
      //  //  .should('not.exist')
//
      //}
      //  cy.contains('Area Name')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.contains('How important')
      //  cy.get(".mt-1 > .block")
      //    .should('be.visible')
      //    .clear()
      //    .type("Sea cucumber fishing area.")
      //  cy.contains('What type of gear')
      //  cy.contains('What type of species')
      //  cy.get('[title="Pole and Line"]')
      //    .should('not.exist')
      //  cy.get('[title="Pole and Line"]')
      //    .should('not.exist')
      //  cy.get('[title="Yellowfin"]')
      //    .should('not.exist')
      //  cy.get('[title="Sea cucumber"]').click()
      //  cy.get('[title="Jigging"]').click()
      //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Sea cucumber love this spot!")
      //  cy.contains('Save').click()
      //});
      //it(`Errors when invalid polygon is drawn - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device)
      //  cy.contains("Save").should('not.exist')
      //  cy.contains('New Shape').as('newShape')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('@newShape').then(($btn) => {
      //    {$btn.trigger('click')}
      //  });
      //  cy.get('@newShape')
      //    .should('not.exist')
      //  cy.get('[role="progressbar"]')
      //    .should('not.exist')
      //  drawInvalidPolygon()
      //  cy.get('button').contains('Invalid Shape').as('invalidShapeBtn')
      //  cy.get('@invalidShapeBtn').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //  cy.get('[role="dialog"]').contains('Invalid Shape')
      //  cy.get('video').should('be.visible')
      //  cy.get('button').contains('Okay').as('okayBtn')
      //  cy.get('@okayBtn').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //  cy.get('button').contains('Done').as('doneBtn')
      //  const stub = cy.stub()  
      //  cy.on ('window:alert', stub)
      //  cy.get('@doneBtn').then(($btn) => {
      //    {$btn.trigger('click')}
      //    expect(stub.getCall(0)).to.be.calledWith('Please fix problems with your shape first.') 
      //  })
      //}); 
      //it(`Can delete invalid shape - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device);
      //  cy.get('.flex-shrink-0 > :nth-child(1) ').as('trashBtn');
      //  const stub = cy.stub();
      //  cy.on ('window:confirm', stub);
      //  cy.get('@trashBtn').then(($btn) => {
      //    {$btn.trigger('click')};
      //    expect(stub.getCall(0)).to.be.calledWith('Are you sure you want to delete this shape?');
      //  });
      //});
      //it(`Can draw second shape - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device)
      //  if (device === "macbook-15" || device === "ipad-2") {
      //    cy.contains('New Shape').as('newShape');
      //    cy.get('@newShape').then(($btn) => {
      //      {$btn.trigger('click')}
      //    })
      //    cy.get('[type = "button"]').then(($btn) => {
      //      if ($btn.text().includes('New Shape')) {
      //        cy.get('button').contains('New Shape').as('newShapeBtn').then(($btn) => {
      //          {$btn.trigger('click', {multiple: true})}
      //        });
      //      }; 
      //    });
      //    cy.get('h4').contains('Fisheries - Recreational')
      //      .should('not.exist');
      //    cy.contains('Area Name')
      //      .should('exist')
      //      .and('be.visible');
      //    cy.contains('How important is this area?')
      //      .should('exist')
      //      .and('be.visible');
      //  }
      //  drawSecondPolygon();
      //  if (device === "iphone-x" || device === "iphone-5") {
      //    cy.get('[data-cy="button-done"]').as('doneBtn')
      //      .should('exist')
      //      .and('be.visible')
      //      .click()
      //  }
      //});
      //it(`Renders sector specific attributes for second shape - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device);
      //  cy.get('h1').contains('Area Name')
      //    .should('exist')
      //    .and('be.visible');
      //  cy.get(".mt-1 > .block").clear()
      //    .type("Reef fishing area.");
      //  cy.contains('What type of gear');
      //  cy.contains('What type of species');
      //  cy.get('[title="Pole and Line"]')
      //    .should('not.exist');
      //  cy.get('[title="Yellowfin"]')
      //    .should('not.exist');
      //  cy.get('button').contains('Handline')
      //    .should('be.visible')
      //    .click();
      //  cy.get('button').contains('Reef fish')
      //    .should('be.visible')
      //    .click();
      //  cy.get('[style="max-height: 60vh;"] > .w-full').type("Bountiful reef fishing.");
      //  cy.contains('Save').click();
      //})
      //it(`Can finish sector - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device);
      //  cy.contains("Sea cucumber fishing area.");
      //  cy.contains("Reef fishing area.");
      //  cy.contains("Fisheries - Commercial, Non-Tuna Species")
      //  //cy.get(".space-y-2 > :nth-child(2) > .select-none").should('be.visible').then(($el) => {
      //  //  {$el.trigger('click')}
      //  //})
      //  cy.contains("Finish Sector").as("finishSector")
      //  cy.get('@finishSector').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //})
      //it (`Shows completed sectors - Fisheries - Commercial, Non-Tuna Species - ${device}`, () => {
      //  cy.viewport(device);
      //  if (device !== "iphone-x") {
      //    //these don't exist on this page for iphone-x
      //    checkForNavAndLang();
      //  }
      //  
      //  cy.get('button').then(($btn) => {
      //    if ($btn.text().includes("Finish Sector")) {
      //      cy.get('button').contains("Finish Sector").then(($btn) => {
      //        {$btn.trigger('click', {multiple: true})};
      //      });
      //    };
      //  });
      //  cy.get('h1').contains('Your sectors')
      //  //completed sector
      //  cy.get('button').contains('Fisheries - Commercial, Tuna').parent().then(($btn) => {
      //    expect ($btn.css('background')).to.include('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153))')
      //  })
      //  //completed sector
      //  cy.get('button').contains('Fisheries - Commercial, Non-Tuna Species').parent().then(($btn) => {
      //    expect ($btn.css('background'))
      //    .to
      //    .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      //  })
      //  cy.contains("Next Question").as('nextQuestion')
      //  cy.get('@nextQuestion').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //})
      //it(`Can input number of people reflected in response - ${device}`, () => {
      //  cy.viewport(device);
      //  checkForNavAndLang();
      //  cy.get('[data-question="yes"]').contains('Please indicate how many people are reflected in this response')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('input[type="number"]').as('numberInput')
      //    .should('exist');
      //  cy.log('A user can skip question')
      //  cy.get('@numberInput').then(($input) => {
      //    expect ($input.val()).to.equal('0')
      //  })
      //  cy.contains('response')
      //  cy.log('A user can input number by typing')
      //  cy.get('@numberInput').type('4').then(($input) => {
      //    expect ($input.val()).to.equal('04')
      //  });
      //  cy.log('Using substract button to adjust number')
      //  cy.get('button[title="Subtract"]')
      //    .click()
      //    .click();
      //  cy.get('@numberInput').then(($input) => {
      //    expect ($input.val()).to.equal('2');
      //  });
      //  cy.log('Using add button to adjust number')
      //  cy.get('button[title=Add]')
      //    .click()
      //  cy.get('@numberInput').then(($input) => {
      //    expect ($input.val()).to.equal('3');
      //  });
      //  cy.get('button').contains('Next').as('nextQuestionBtn')
      //    .should('exist')
      //    //.and('be.visible')
      //    .then(($btn) => {
      //      {$btn.trigger('click')}
      //    });
      //});
      //it(`Can input name or number of vessel - ${device}`, () => {
      //  cy.viewport(device); 
      //  checkForNavAndLang();
      //  cy.contains('vessel')
      //    .should('exist')
      //    .and('be.visible');
      //  cy.log('Skipping question without inputting value');
      //  cy.get('input').as('vesselInput')
      //    .should('be.empty');
      //  cy.get('button').contains('Skip Question').click();
      //  cy.restoreLocalStorage();
      //  cy.getLocalStorage('slug').then((slug) => {
      //    cy.getLocalStorage('surveyId').then((id) => {
      //      cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/28/`);
      //    })
      //  })
      //  cy.contains('willing')
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('a[title="Previous Question"]').click()
      //  cy.contains('vessel')
      //    .should('be.visible')
      //    .and('exist')
      //  cy.get('@vesselInput').type("Queen Ann's Revenge")
      //  cy.get('@vesselInput').then(($input) => {
      //    expect ($input.val()).to.equal("Queen Ann's Revenge");
      //  });
      //  cy.get('button').contains('Next').click()
      //});
      //it(`Can answer additional questions - ${device}`, () => {
      //  cy.viewport(device);
      //  checkForNavAndLang();
      //  cy.contains('additional')
      //    .should('exist')
      //    .and('be.visible');
      //  cy.get('[title="Yes"]')
      //    .should('exist')
      //    .and('be.visible')
      //    .click()
      //});
      //it(`Can input age - ${device}`, () => {
      //  cy.viewport(device);
      //  checkForNavAndLang();
      //  cy.restoreLocalStorage()
      //  cy.getLocalStorage('slug').then((slug) => {
      //    cy.getLocalStorage('surveyId').then((id) => {
      //      cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/29/`);
      //    })
      //  })
      //  cy.contains('willing')
      //    .should('not.exist')
      //  cy.contains("Your age")
      //    .should('exist')
      //    .and('be.visible')
      //  cy.get('input').clear().type("30")
      //  cy.contains('Next').as('nextBtn');
      //  cy.get('@nextBtn').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //})
      //it(`Can select gender - ${device}`, () => {
      //  cy.viewport(device); 
      //  checkForNavAndLang();
      //  cy.contains("Gender")
      //  cy.contains("Female").click()
      //})
      //it(`Can add comments - ${device}`, () => {
      //  cy.viewport(device);
      //  checkForNavAndLang();
      //  cy.get("textarea").type("My general comments.")
      //  cy.contains("Complete Submission").as('completeSubmission')
      //  cy.get('@completeSubmission').should('be.visible').then(($btn) => {
      //    {$btn.trigger('click')}
      //  })
      //  cy.contains('General Comments')
      //    .should('not.exist')
      //})
      //it(`Records the correct response - ${device} `, () => {
      //  cy.wait("@createResponse").then((req) => {
      //    expect (req.response.statusCode).to.eq(200)
      //    const surveyResponseId = req.response.body.data.createSurveyResponse.surveyResponse.id
      //    expect (surveyResponseId).to.not.equal(null)
      //    cy.restoreLocalStorage()
      //    cy.getLocalStorage("access_token").then((token) => {
      //      cy.getSurveyResponse(surveyResponseId, token).then((resp) => {
      //      const data = resp.query.surveyResponse.data
      //      const responseAry = []
      //      Object.entries(data).forEach(([, value]) => {
      //          responseAry.push(value)
      //      });
      //        const sketchIds = []
      //        Object.entries(responseAry[4].collection).forEach(([, value]) => {
      //          sketchIds.push(value)
      //        });
      //        expect(responseAry.length).to.eq(11)
      //        sketchIds.forEach((id) => {
      //         cy.getSketch(id, token).then((sketch) => {
      //           expect (sketch.sketch.userGeom.geojson.coordinates[0]).to.not.be.empty
      //         });
      //        });
      //        expect (responseAry[0].name).to.eq('Test User 1')
      //        expect (responseAry[1]).to.eq('test_user_1@seasketch.org')
      //        expect (responseAry[2][0]).to.eq('N')
      //        expect (responseAry[3][0]).to.eq('Kudafari')
      //        expect (responseAry[4].sectors[0]).to.eq("Fisheries - Commercial, Tuna")
      //        expect (responseAry[4].sectors[1]).to.eq("Fisheries - Commercial, Non-Tuna Species")
      //        expect (responseAry[5]).to.eq(3)
      //        expect (responseAry[6]).to.eq("Queen Ann's Revenge")
      //        expect (responseAry[7]).to.eq(true)
      //        expect (responseAry[8]).to.eq(30)
      //        expect (responseAry[9][0]).to.eq("Female")
      //        expect (responseAry[10]).to.eq("My general comments.")
      //      });
      //    });
      //  });
      //  if (device === "macbook-15" || device === "ipad-2") {
      //    cy.get('h1').contains('Thank You')
      //      .should('be.visible');
      //    cy.get('button').contains('Submit Another Response')
      //      .should('exist')
      //      .click();
      //    }
      //  });
      });
    })//;
  });//