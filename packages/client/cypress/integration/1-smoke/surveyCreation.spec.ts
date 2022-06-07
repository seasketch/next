/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";

let surveyId: any;
let authToken: any;
let formId: any;

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
  cy.get('@el').click(300,300)        
    .click(300, 100)
    .click(100, 100)
    .click(100, 300)
    .dblclick(300, 300)
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
  cy.get('@el').click(300,300)        
    .click(100, 300)
    .click(150, 200)
    .click(50, 200)
    .dblclick(300, 300)
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
  cy.get('@el').click(250,250)     
    .click(50, 250)
    .click(50, 50)
    .click(250, 50)
    .dblclick(250, 250)
};

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
    it ("Advances to SAP page", () => {
      cy.get('[type = "button"]').then(($btn) => {
        if($btn.html() === "Next") {
          cy.wrap($btn).as('nextBtn')
          {$btn.trigger('click')}
        }
      })
    })
    it("Can draw a polygon - Fisheries - Commercial, Tuna", () => {
      cy.get('[type = "button"]').as('nextBtn').then(($btn) => {
        if($btn.html() === "Next") {
          {$btn.trigger('click')}
        } 
      })
      cy.get('h4').contains('Fisheries - Commercial, Tuna')
        .should('exist')
        .and('be.visible')
      //Check that basemaps are loaded in window
      cy.window().its('mapContext.basemaps').then((maps) => {
        Object.keys(maps).forEach((key) => {
          expect (basemaps[maps[key].name]).to.exist
        })
      })
      //cy.wait('@mapboxApiCall')
      //wait on all calls to Mapbox Api
      waitOnMapbox(3)
      cy.get('[role="progressbar"]')
        .should('not.exist')
      drawPolygon()
    })
    //it('Can view basemap selector', () => {
    //  cy.get('img').click()
    //  let values = ['Reset view', 'Focus on location', 'Show scale bar', 'Basemap', 'Maldives Light', 'Satellite']
    //  values.forEach((val) => {
    //    cy.get('.fixed > .overflow-y-auto').children().contains(val)
    //  })
    //})
    //it ('Can show scale bar', () => {
    //  cy.get('h4').contains('Show scale bar')
    //  cy.get('[role="switch"]').then(($switch) => {
    //    {$switch.trigger('click')}
    //  })
    //  cy.contains('5000 km')
    //})
    //it ('Renders the correct basemap', () => {
    //  cy.contains('Maldives Light').as('maldivesLightBasemap')
    //  cy.get('@maldivesLightBasemap').then(($btn) => {
    //    {$btn.trigger('click')}
    //  })
    //  cy.get('@maldivesLightBasemap').should('have.class', 'font-semibold')
    //  cy.contains('Satellite')
    //    .should('not.have.class', 'font-semibold')
    //})
    //it ('Can select different basemap', () => {
    //  cy.contains('Satellite').as('satelliteBasemap')
    //    cy.get('@satelliteBasemap').then(($btn) => {
    //      {$btn.trigger('click')}
    //    })
    //    .should('have.class', 'font-semibold')   
    //  cy.contains('Maldives Light')
    //    .should('not.have.class', 'font-semibold')
    //})
    //it('Shows option to focus on location', () => {
    //  cy.restoreLocalStorage()
    //  cy.window().its('mapContext.map.transform._center').as('centerCoords').then((center) => {
    //    cy.setLocalStorage("lat", `${center["lat"]}`)
    //    cy.setLocalStorage("long", `${center["lng"]}`)
    //    cy.getLocalStorage("surveyId").then((id) => {
    //      cy.setLocalStorage("surveyId", id)
    //    });
    //    cy.saveLocalStorage();
    //    cy.get('h4').contains('Focus on location').click();
    //  });
    //});
    //it('Focuses on location', () => {
    //  cy.restoreLocalStorage()
    //  cy.getLocalStorage('lat').then((lat) => {
    //    cy.getLocalStorage('long').then((lng) => {
    //      cy.window().its('mapContext.map.transform._center').then((coords) => {
    //        expect (coords["lat"]).to.not.equal(lat)
    //        expect (coords["lng"]).to.not.equal(lng)
    //      });
    //    });
    //  });
    //});
    it('Renders sector specific attributes - Fisheries - Commercial, Tuna', () => {
      //cy.get('img').then((imgs) => {
      //  imgs[0].click()
      //})
      cy.get('h1').contains('Area Name')
        .should('exist')
        .and('be.visible')
      cy.get(".mt-1 > .block").scrollIntoView().clear()
        .type("Yellowfin tuna fishing area.")
      cy.contains('What type of gear do you use here?')
      cy.contains('What species do you fish here')
      cy.get('[title="Pole and Line"]').click()
      cy.get('[title="Yellowfin"]').click()
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Heavy use in spring and summer.")
    })
    it ('Can set area importance using SAP range slider', () => {
      cy.get('h1').contains('How important is this area?').scrollIntoView();
      cy.get('input[type=range]').as('range')
        .should('exist');
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      cy.get('@range').then(($range) => {
        // get the DOM node
        const range = $range[0];
        // set the value manually
        nativeInputValueSetter.call(range, 15);
        // dispatch the event
        //@ts-ignore
        range.dispatchEvent(new Event('change', { value: 15, bubbles: true }));
      });
      cy.get('@range')
        .should('have.value', 15);
      cy.contains('Save').click();
      cy.get('.SAPRangeMini')
        .should('exist')
        .and('have.value', 15);
    });
    it('Can finish sector - Fisheries - Commercial, Tuna', () => {
      cy.contains('Fisheries - Commercial, Tuna')
        .should('be.visible');
      cy.contains("Yellowfin tuna fishing area.");
      cy.get(".space-y-2 > :nth-child(2) > .select-none").as('finishSector').should('be.visible').then(($el) => {
        console.log($el)
        {$el.trigger('click')}
      });
      cy.get('@finishSector').should('not.exist')
      cy.contains("Next sector").as("nextSector")
      cy.get('@nextSector').then(($btn) => {
        {$btn.trigger('click')}
      });
    });
    it('Can draw a polygon - Fisheries - Commercial, Non-Tuna Species', () => {
      let ary = []
      cy.get('button').then(($btn) => {
        //@ts-ignore
        $btn.toArray().forEach((t) => {
          ary.push(t.innerText)
        })
        if(ary.includes('Next sector')) {
          console.log("true")
          cy.get('button').contains('Next sector').then(($btn) => {
            console.log($btn)
            {$btn.trigger('click')}
            
          })
        }
      })
      cy.get('button').contains('Next sector').should('not.exist')
      waitOnMapbox(3)
      cy.get('[role="progressbar"]')
          .should('not.exist')
      cy.get('h4').contains('Fisheries - Commercial, Non-Tuna Species')
        .should('exist')
        .and('be.visible')
     
      drawPolygon()
    })
    it("Renders sector specific attributes - Fisheries - Commercial, Non-Tuna Species", () => {
      cy.get('h1').contains('Area Name')
        .should('exist')
        .and('be.visible')
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
    it('Can finish sector - Fisheries - Commercial, Non-Tuna Species', () => {
      cy.contains("Sea cucumber fishing area.")
      cy.contains("Fisheries - Commercial, Non-Tuna Species")
      cy.get(".space-y-2 > :nth-child(2) > .select-none").should('be.visible').then(($el) => {
        {$el.trigger('click')}
      })
      cy.contains("Finish Sector").as("finishSector")
      cy.get('@finishSector').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    it ('Shows completed sectors - Fisheries - Commercial, Non-Tuna Species', () => {
      cy.get('h1').contains('Your sectors')
      cy.get('button').contains('Fisheries - Commercial, Tuna').parent().then(($btn) => {
        expect ($btn.css('background')).to.include('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153))')
      })
      //completed sector
      cy.get('button').contains('Fisheries - Commercial, Non-Tuna Species').parent().then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      })
      //completed sector
      cy.get('button').contains('Fisheries - Commercial, Tuna').parent().then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      })
      //not yet completed sector
      cy.get('button').contains('Fisheries - Recreational').parent().then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(23, 52, 53, 0.8) none repeat scroll 0% 0% / auto padding-box border-box')
      })
      //not yet completed sector
      cy.get('button').contains('Fisheries- Artisanal/Subsistence').parent().then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(23, 52, 53, 0.8) none repeat scroll 0% 0% / auto padding-box border-box')
      })
      cy.contains("Next sector").as("nextSector")
      cy.get('@nextSector').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    it('Can draw a polygon - Fisheries - Recreational', () => {
      cy.get('[type = "button"]').contains('Next')
        .should('not.exist')
      cy.get('h4').contains('Fisheries - Recreational')
        .should('exist')
        .and('be.visible')
      waitOnMapbox(3)
      cy.get('[role="progressbar"]')
        .should('not.exist')
      drawPolygon()
    })
    it("Renders sector specific attributes - Fisheries - Recreational", () => {
      cy.get('h1').contains('Area Name')
        .should('exist')
        .and('be.visible')
      cy.get(".mt-1 > .block").clear()
        .type("Reef fishing area.")
      cy.contains('What type of recreational fishing do you do here?')
      cy.contains('What type of species do you fish here?')
        .should('not.exist')
      cy.get('[title="Pole and Line"]')
        .should('not.exist')
      cy.get('[title="Yellowfin"]')
        .should('not.exist')
      cy.get('[title="Reef Fishing"]').click()
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Bountiful reef fishing.")
      cy.contains('Save').click()
    })
    it('Can draw second shape - Fisheries - Recreational', () => {
      cy.contains('New Shape').as('newShape')
      cy.get('@newShape').then(($btn) => {
        {$btn.trigger('click')}
      })
      cy.get('[type = "button"]').then(($btn) => {
        if ($btn.text().includes('New Shape')) {
          cy.get('button').contains('New Shape').as('newShapeBtn').then(($btn) => {
            {$btn.trigger('click', {multiple: true})}
          });
        }; 
      });
      cy.get('h4').contains('Fisheries - Recreational')
        .should('not.exist');
      cy.contains('Area Name')
        .should('exist')
        .and('be.visible');
      cy.contains('How important is this area?')
        .should('exist')
        .and('be.visible');
      drawSecondPolygon();
    });
    it("Renders sector specific attributes for second shape - Fisheries - Recreational", () => {
      cy.get('h1').contains('Area Name')
        .should('exist')
        .and('be.visible')
      cy.get(".mt-1 > .block").clear()
        .type("Sports fishing area.");
      cy.contains('What type of recreational fishing do you do here?');
      cy.contains('What type of species do you fish here?')
        .should('not.exist');
      cy.get('[title="Pole and Line"]')
        .should('not.exist');
      cy.get('[title="Yellowfin"]')
        .should('not.exist');
      cy.get('[title="Big Game / Sports Fishing"]').click();
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Exciting sport fishing.");
      cy.contains('Save').click();
    })
    it('Can finish sector - Fisheries - Recreational', () => {
      cy.contains("Fisheries - Recreational");
      cy.contains("Reef fishing area.");
      cy.contains("Sports fishing area");
      cy.contains("Finish Sector").as("finishSector");
      cy.get('button').then(($btn) => {
        if ($btn.text().includes("Finish Sector")) {
          cy.get('button').contains("Finish Sector").then(($btn) => {
            {$btn.trigger('click', {multiple: true})};
          });
        };
      });
      cy.get('@finishSector').then(($btn) => {
        {$btn.trigger('click')};
      });
    });
    it ('Shows completed sectors - Fisheries - Recreational', () => {
      cy.get('button').then(($btn) => {
        if ($btn.text().includes("Finish Sector")) {
          cy.get('button').contains("Finish Sector").then(($btn) => {
            {$btn.trigger('click', {multiple: true})}
          })
        }
      })
      cy.get('h1').contains('Your sectors')
        .should('be.visible')
      //additional completed sector
      cy.get('div').contains(/\BFisheries - Recreational|Fisheries - Recreational\B/).then(($btn) => {
      expect ($btn.css('background'))
      .to
      .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      })
      //not yet completed sector
      cy.get('button').contains('Fisheries- Artisanal/Subsistence').parent().then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(23, 52, 53, 0.8) none repeat scroll 0% 0% / auto padding-box border-box')
      })
      cy.contains("Next sector").as("nextSector")
      cy.get('@nextSector').then(($btn) => {
        {$btn.trigger('click')}
      })
    })
    it('Errors when invalid polygon is drawn - Fisheries - Artisanal/Subsistence', () => {
      let ary = []
      cy.get('button').then(($btn) => {
        //@ts-ignore
        $btn.toArray().forEach((t) => {
          ary.push(t.innerText)
        });
        if (ary.includes('Next sector')) {
          console.log("true")
          cy.get('button').contains('Next sector').then(($btn) => {
            console.log($btn)
            {$btn.trigger('click')}
          });
        };
      });
      cy.get('button').contains('Next sector').should('not.exist');
      cy.get('h4').contains('Fisheries- Artisanal/Subsistence')
        .should('exist')
        .and('be.visible')
      waitOnMapbox(3)
      cy.get('[role="progressbar"]')
        .should('not.exist')
      drawInvalidPolygon()
      cy.get('button').contains('Invalid Shape').as('invalidShapeBtn')
      cy.get('@invalidShapeBtn').then(($btn) => {
        {$btn.trigger('click')}
      })
      cy.get('[role="dialog"]').contains('Invalid Shape')
      cy.get('video').should('be.visible')
      cy.get('button').contains('Okay').as('okayBtn')
      cy.get('@okayBtn').then(($btn) => {
        {$btn.trigger('click')}
      })
      cy.get('button').contains('Done').as('doneBtn')
      const stub = cy.stub()  
      cy.on ('window:alert', stub)
      cy
      cy.get('@doneBtn').then(($btn) => {
        {$btn.trigger('click')}
        expect(stub.getCall(0)).to.be.calledWith('Please fix problems with your shape first.') 
      })
    })  
    it('Can delete invalid shape - Fisheries - Artisanal/Subsistence', () => {
      //trash icon
      cy.get('.flex-shrink-0 > :nth-child(1) ').as('trashBtn');
      const stub = cy.stub();
      cy.on ('window:confirm', stub);
      cy.get('@trashBtn').then(($btn) => {
        {$btn.trigger('click')};
        expect(stub.getCall(0)).to.be.calledWith('Are you sure you want to delete this shape?');
      });
      cy.contains('New Shape').as('newShape');
      cy.get('@newShape').then(($btn) => {
        {$btn.trigger('click')}
      })
    });
    it('Can draw new shape - Fisheries - Artisanal/Subsistence', () => {
      cy.get('[type = "button"]').then(($btn) => {
        if ($btn.text().includes('New Shape')) {
          cy.get('button').contains('New Shape').as('newShapeBtn').then(($btn) => {
            {$btn.trigger('click', {multiple: true})}
          });
        }; 
      });
      cy.get('h4').contains('Fisheries - Artisanal/Subsistence')
        .should('not.exist')
      cy.contains('Area Name')
        .should('exist')
        .and('be.visible')
      cy.contains('How important is this area?')
        .should('exist')
        .and('be.visible')
      drawPolygon();
    })
    it("Renders sector specific attributes - Fisheries - Artisanal/Subsistence", () => {
      cy.get('h1').contains('Area Name')
        .should('exist')
        .and('be.visible')
      cy.get(".mt-1 > .block").clear()
        .type("Grouper fishing area.")
      cy.contains('What type of recreational fishing do you do here?')
        .should('not.exist');
      cy.contains('What species do you fish here?');
      cy.get('[title="Pole and Line"]')
        .should('not.exist');
      cy.get('[title="Yellowfin"]')
        .should('not.exist');
      cy.get('[title="Grouper"]').click();
      cy.get('[style="max-height: 60vh;"] > .w-full').type("Prolific grouper population here.");
      cy.contains('Save').click();
    });
    it('Can finish sector - Fisheries - Recreational', () => {
      cy.contains("Fisheries- Artisanal/Subsistence");
      cy.contains("Grouper fishing area.");
      cy.get(".space-y-2 > :nth-child(2) > .select-none")
        .should('be.visible').then(($el) => {
          {$el.trigger('click')}
        });
      cy.contains("Finish Sector").as("finishSector");
      cy.get('@finishSector').then(($btn) => {
        {$btn.trigger('click')}
      });
    });
    it('Shows completed sectors - Fisheries - Recreational', () => {
      cy.get('h1').contains('Your sectors')
        .should('be.visible');
      //additional completed sector
      cy.get('div').contains(/\BFisheries - Recreational|Fisheries - Recreational\B/).then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      });
      //not yet completed sector
      cy.get('div').contains("Fisheries- Artisanal/Subsistence").then(($btn) => {
        expect ($btn.css('background'))
        .to
        .equal('rgba(0, 0, 0, 0) linear-gradient(rgb(62, 188, 181), rgb(39, 160, 153)) repeat scroll 0% 0% / auto padding-box border-box')
      });
    });
    //it('Can input number of people reflected in response', () => {
    //  cy.get('button').contains('Next Question').as('nextQuestionBtn')
    //    .should('be.visible')
    //    .and('exist')
    //    .then(($btn) => {
    //      {$btn.trigger('click')}
    //    })
    //  cy.get('[data-question="yes"]').contains('Please indicate how many people are reflected in this response')
    //    .should('be.visible')
    //    .and('exist')
    //  cy.get('input[type="number"]').as('numberInput')
    //    .should('exist');
    //  cy.log('A user can use navigation arrows to skip question')
    //  cy.get('@numberInput').then(($input) => {
    //    expect ($input.val()).to.equal('0')
    //  })
    //  cy.get('a[title="Next Question"]').click()
    //  cy.contains('vessel')
    //  cy.get('a[title="Previous Question"]').click()
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
    //  cy.get('button').contains('Next').click()
    //});
    //it("Can input name or number of vessel", () => {
    //  cy.contains('vessel')
    //    .should('exist')
    //    .and('be.visible')
    //  cy.log('Skipping question without inputting value')
    //  cy.get('input').as('vesselInput')
    //    .should('be.empty')
    //  cy.get('button').contains('Skip Question').click()
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
    //
    //it("Can answer additional questions", () => {
    //  //cy.restoreLocalStorage()
    //  //cy.getLocalStorage('surveyId').then((id) => {
    //  //  cy.getLocalStorage('slug').then((slug) => {
    //  //    cy.visit(Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`);
    //  //    cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`)
    //  //  })
    //  //  
    //  //})
    //  ////cy.wait('@getProjectMetadata')
    //  //  .its('response.statusCode').should('eq', 200)
    //  cy.contains('additional')
    //    .should('exist')
    //    .and('be.visible')
    //  cy.get('[title="Yes"]')
    //    .should('exist')
    //    .and('be.visible')
    //    .click()
    //})
//////
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
    //        const responseAry = []
    //        Object.entries(data).forEach(([, value]) => {
    //          responseAry.push(value)
    //        })
    //        const sketchIds = []
    //       Object.entries(responseAry[4].collection).forEach(([, value]) => {
    //         sketchIds.push(value)
    //       })
    //       expect(responseAry.length).to.eq(11)
    //       sketchIds.forEach((id) => {
    //        cy.getSketch(id, token).then((sketch) => {
    //          expect (sketch.sketch.userGeom.geojson.coordinates[0]).to.not.be.empty
    //        })
    //       })
    //       expect (responseAry[0].name).to.eq('Test User 1')
    //       expect (responseAry[1]).to.eq('test_user_1@seasketch.org')
    //       expect (responseAry[2][0]).to.eq('N')
    //       expect (responseAry[3][0]).to.eq('Kudafari')
    //       expect (responseAry[4].sectors[0]).to.eq("Fisheries - Commercial, Tuna")
    //       expect (responseAry[4].sectors[1]).to.eq("Fisheries - Commercial, Non-Tuna Species")
    //       expect (responseAry[4].sectors[2]).to.eq("Fisheries - Recreational")
    //       expect (responseAry[4].sectors[3]).to.eq("Fisheries- Artisanal/Subsistence")
    //       expect (responseAry[5]).to.eq(3)
    //       expect (responseAry[6]).to.eq("Queen Ann's Revenge")
    //       expect (responseAry[7]).to.eq(true)
    //       expect (responseAry[8]).to.eq(30)
    //       expect (responseAry[9][0]).to.eq("Female")
    //       expect (responseAry[10]).to.eq("My general comments.")
    //        })
    //      })
    //    })
    //  })
    //  it("Skips to end when answer to additional questions is no", () => {
    //    cy.restoreLocalStorage()
    //    cy.getLocalStorage('surveyId').then((id) => {
    //      cy.getLocalStorage('slug').then((slug) => {
    //        cy.visit(Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`);
    //        cy.url().should('eq', Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`)
    //      })
    //      
    //    })
    //    //cy.wait('@mapBoxApiCall')
    //    cy.wait('@getSurvey')
    //    cy.get('h1')
    //      .should('be.visible');
    //    cy.get('[title="No"]')
    //      .should('be.visible')
    //      .click();
    //    cy.get('h4').contains('Submitting')
    //      .should('not.exist')
    //    cy.get('h1').contains('Thank You for Responding')
    //      .should('be.visible')
    //      .and('exist')
    //    cy.restoreLocalStorage();
    //    cy.getLocalStorage('surveyId').then((id) => {
    //      cy.getLocalStorage('slug').then((slug) => {
    //        cy.visit(Cypress.config().baseUrl + `/${slug}/surveys/${id}/28`);
    //      });
    //    });
    //    //cy.wait('@mapBoxApiCall')
    //  });
  })//
    //
  })////
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
        cy.intercept('https://api.mapbox.com/v4/*').as('mapboxApiRequest')
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

  //});//
});//
//
//only
//data-cy
//get through survey
//abstract
//azores