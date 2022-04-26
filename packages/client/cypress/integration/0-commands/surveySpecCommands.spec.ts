/* eslint-disable cypress/no-unnecessary-waiting */
//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { CursorType, ProjectAccessControlSetting, ProjectInviteEmailStatusSubscriptionDocument, RequestInviteOnlyProjectAccessDocument } from "../../../src/generated/graphql";
import "cypress-localstorage-commands"
import { verify } from "crypto";
import { VariablesInAllowedPositionRule } from "graphql";
const FormData = require('form-data')
const fetch = require('node-fetch')

var body = new FormData()




//const FormData = require('form-data')
//import fetch = require('node-fetch');

const createBasemaps = (token, id) => {
  body.append(
    //'hello', 'whatsup'
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
            name: "Maldives Light", 
            type: "MAPBOX",
            url: "mapbox://styles/seasketch/ckxywn6wm4r2h14qm9ufcu23w",
            thumbnail: null
          }
        }
      }
    })
  )
  
  const file = new File(["foo"], "foo.jpg", {
    type: "image/jpeg",
  });

  
  //console.log(body)
  body.append('map', JSON.stringify({ 1: ['variables.input.basemap.thumbnail'] }))
  //body.append('my_file', fs.createReadStream('/foo/bar.jpg'));
  body.append('1', file)
  //body.append('authorization')

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
  
  //.mutation(
  //  gql`
  //   mutation CreateBasemap($input: CreateBasemapInput!) {
  //    createBasemap(input: $input) {
  //      basemap{
  //        id
  //      }
  //    }
//
  //    }
  //  `,
  //  { "input": {
  //    "basemap": {
  //        "projectId": 1441,
  //        "name": "Maldives Light", 
  //        "type": "type": "MAPBOX",
  //        "url": "mapbox://styles/seasketch/ckxywn6wm4r2h14qm9ufcu23w" 
  //        "thumbnail": null
  //      }
  //    //
  //    }
  //  },
  //(token as any)
  //).then((data) => {
  //  Cypress.log(data)
  //  return data
  //})
}


let surveyId: any
let authToken: any
let formId: any
let response: any
let sapId: any

const generateSlug = () => { 
  const result = Math.random().toString(36).substring(2,7);
  return result
}

const slug = generateSlug()

const addFormLogicAndConditions = () => {
  cy.get('@token').then((token) => {
    authToken = token
  })
  cy.get('@formId').then((id) => {
    formId = id
    cy.deleteFormElements(formId, authToken).then((resp) => {
      const elementsToUpdate = []
      resp.deleteFormElement.query.form.formElements.forEach(t => {
        elementsToUpdate.push(t)
      })
      cy.updateFormElements(elementsToUpdate,"Maldives", authToken, formId)
      cy.createFormElements(formId, "Maldives", authToken).then((resp) => {
        const SAPFormId = formId + 1
        cy.createSAPElements(SAPFormId, "Maldives", authToken).then((resp) => {
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
        const sapId = jumpToIds[1]
        cy.updateJumpToId(jumpToIds, elementsToUpdate, formId, authToken)
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
         cy.updateSubordinateToId(sapId, updateSubToIdElements, formId, authToken)
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
          cy.createFormLogicRules(formId, "Maldives", newIds, authToken).then((resp: object) => {
            cy.wrap(resp).as("createFormLogicResponse")
          })
        })
      })
  })
}

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
      } else if ((req.body.operationName) && (req.body.operationName === "CypressSetAccessControl")) {
        req.alias = "setAccessControlRequest"
      } else {
        req.alias = "createBasemapRequest"
      }
        //req.continue((resp) => {
        //  if (resp.body.data.createBasemap) {
        //    cy.wrap(resp).as('createBasemapResponse')
        //  }
        //})
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
  //it ("Creates the project", () => {
  //  cy.wait('@createProjectRequest')
  //    .its('response.body.data.createProject.project')
  //    .should('have.property', 'id')
  //})
  //it ("Creates the survey", () => {
  //  cy.wait("@createSurveyRequest").its('response').then((resp) => {
  //    const formElements = resp.body.data.makeSurvey.survey.form.formElements
  //    expect (formElements.length).to.eq(5)
  //  }) 
  //})
  it.only("Can add basemaps", () => {
    cy.get('@token').then((token: any) => {
      cy.get('@projectId').then((id) => {
        createBasemaps(token, id)
        
        //.then((resp) => {
        //  
        //  const read = resp.getReader()
        //  console.log(read.read())
        //})
        cy.wait('@createBasemapRequest').then((req) => {
          if (req.response.body.errors) {
            cy.log(req.response.body.errors)
          } else {
            cy.log("no errors")
          }
          //cy.log(req.response.body)

          expect (req.response.body).to.not.equal(null)
        })
      })
      
      
      //})
    })
    //console.log(fetchResponse)
    //fetchResponse().then((resp) => {
    //  console.log(resp)
    //})
    cy.get('@projectId').then((id: any) => {
      cy.get('@token').then((token: any) => {
        //console.log(fetchResponse)
        
        //cy.createBasemaps("Maldives", id, token).then((resp) => {
        //  console.log(resp)
        //})
      })
      
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
              const formElements = resp.updateFormElement.query.form.formElements
              expect (formElements.length).to.eq(3)
              expect (formElements[0].body.content[0].content[0].text).to.eq("Welcome Ocean Users!")
              cy.setLocalStorage('formElements', formElements)
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
          const elementsToUpdate = elements.slice(5,24)
          for (let i = 0; i < elements.length; i++) {
            if (elements[i].typeId === "SpatialAccessPriorityInput") {
              jumpToId = elements[i].id
              break
            }
          }
          cy.updateJumpToId(jumpToId, elementsToUpdate, formId, authToken).then((resp) => {
        
           //expect (resp.updateFormElement.formElement.jumpToId).to.eq(jumpToId)
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
      cy.get('@token').then((token) => {
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
        cy.updateJumpToId(jumpToIds, elementsToUpdate, formId, authToken)
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
        cy.updateSubordinateToId(sapId, updateSubToIdElements, formId, authToken)
        expect (updateSubToIdElements.length).to.eq(4)
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
         expect (newIds.length).to.eq(22)
          cy.createFormLogicRules(formId, "Maldives", newIds, authToken).then((resp) => {
           expect (resp.createFormLogicCondition.query.form.logicRules.length).does.not.eq(0)
           expect (resp.createFormLogicCondition.query.form.logicRules[0].conditions.length).does.not.eq(0)
          })
        })
      })
      cy.get('@surveyId').then((id) => {
        surveyId = id
        cy.deleteSurvey(surveyId, authToken)
      });
    });
  });  
  it ('Can update childVisibilitySettings', () => {
    addFormLogicAndConditions()
    const exportIds = {
      "tuna_gear": 0, 
      "tuna_species": 1, 
      "gear_ntuna": 2, 
      "nontuna_species": 3, 
      "recfish_type": 4, 
      "num_of_ppl": 5, 
      "part-time": 6, 
      "vessel": 7, 
      "guesthouse_name": 8
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
      cy.get('@sapId').then((id) => {
        //sapId is the id of the SAP form element whose componentSettings need to be updated
        sapId = id
        cy.updateComponentSettings(sapId, referenceElements, authToken, formId).then((resp) => {
          console.log(referenceElements)
          let values: object = Object.values(resp.updateFormElement.formElement.componentSettings.childVisibilitySettings)
          expect (values[0].enabled).to.eq(true) &&
          expect (values[0].sectors.toString()).to.eq('Fisheries - Commercial, Tuna')
          //expect (values[0]).to.include({enabled: true, sectors: ['Fisheries - Commercial, Tuna']})
        });
      });
    };
    let formElements = []
    cy.get('@createFormLogicResponse').then((resp) => {
      response = resp
      formElements.push(response.createFormLogicCondition.query.form.formElements)
    });
    cy.get('@SAPResponse').then((resp) => {
      response = resp
      let settingsAry = formElements[0].concat(response.createFormElement.query.form.formElements)
      updateComponentSettings(settingsAry)
    });
    cy.get('@surveyId').then((id) => {
      surveyId = id
      cy.deleteSurvey(surveyId, authToken)
    });
  });
});


//this was in surveyCreationTests. It wasn't working because to delete a survey, 
//the associated sketches and responses had to be deleted first. Will wait until deleteSurvey ticket is resolved
//to implement
//after(() => {
//  cy.restoreLocalStorage()
//  cy.getLocalStorage("surveyId").then((id) => {
//    surveyId = parseInt(id)
    //cy.getLocalStorage("responseId").then((responseId) => {
//    //  cy.deleteResponse
//    //})
//    //cy.getLocalStorage("token").then((token) => {
//    //  cy.deleteSurvey(surveyId, token)
//    //})
//  })
//  cy.deleteProject(`${slug}`) 
