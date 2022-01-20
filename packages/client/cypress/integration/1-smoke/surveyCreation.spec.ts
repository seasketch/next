//const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];
import { ProjectAccessControlSetting, useCreateSurveyMutation } from "../../../src/generated/graphql";
import { createSurvey } from "../../support/graphQlRequests"
import { gql, useQuery } from '@apollo/client';
import { isTypedArray } from "cypress/types/lodash";
//import ReactDOM from "react-dom";
//import React from "react";
//

//const [createSurvey, createSurveyState] = useCreateSurveyMutation({
  
//});

//export default async function CreateSurvey() {
//  const [createSurvey] = useCreateSurveyMutation()
//  const result = await createSurvey({
//    variables: {
//      projectId: project!,
//      name: 'Test',
//    }
//  })
//  console.log(result)
//}
//
//

//function createSurvey(project, name) {
//  CreateSurvey(project, name)
//}
let project

let surveyId

//function makeSurvey() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  //const [createSurveyMutation, { data, loading, error }] = useCreateSurveyMutation({
  //  variables: {
  //     name: 'test',
  //     projectId: project,
  //     templateId: 2
  //  },
  //});
  ////return data


//const getProjectName = () => {
//  // eslint-disable-next-line react-hooks/rules-of-hooks
//  const { data, loading, error } = useGetProjectBySlugQuery({
//    variables: {
//       slug: slug
//    },
//  });
//  return data
//}
//
//const projectData = getProjectName()
//const projectName = projectData?.projectBySlug?.name
//const projectId = projectData?.projectBySlug?.id
//
//const GET_PROJECT = gql`
//  query GetProject {
//    project(id: ${projectId}) {
//      name
//      sessionIsAdmin
//      logoUrl
//      creatorId
//    }
//  }
//`;

//mutation CreateSurvey($name: String!, $projectId: Int!, $templateId: Int) {
//  makeSurvey(
//    input: { projectId: $projectId, name: $name, templateId: $templateId }
//  ) {
//    survey {
//      ...SurveyListDetails
//    }
//  }
//}

const CREATE_SURVEY = gql`
  mutation makeSurvey {
    makeSurvey(input: { projectId: 1441 , name: "Test"}) {
      survey {
      ...SurveyListDetails}
    }
  }
`;

//function makeSurvey() {
//  const {data, loading, error} = useQuery(CREATE_SURVEY)
//  return data
//}


//const {data, loading, error} = useQuery(GET_PROJECT)





describe ("Survey creation smoke test", () => {
  describe ('A user can create a survey', () => {
    it('Creates the project', () => {

    
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Maldives Survey Test",
          "cy-maldives",
          ProjectAccessControlSetting.Public,
          true
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId").then(() => {
            project = projectId
          });
        });
      });
      cy.visit('/projects')
      
      
    });
    after(() => {
      cy.deleteProject("cy-maldives");
    });
    it("has the project", () => {
      console.log(project)
    })
  })

  //makeSurvey(input: { projectId: 1441 , name: "Test"}) {
  //  survey {
  //  ...SurveyListDetails}
  //}


  describe.only ('creates the survey', () => {
    it('should create the survey', () => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        const createSurvey = `
        mutation makeSurvey {
            makeSurvey(input: { projectId: 1441, name: "test" }) {
              survey {
                projectId, 
                name, 
                id
              }
            }
          } 
        `;
        cy.request({
            log: true,
            url: 'http://localhost:3857/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: {
                query: createSurvey
            },
            failOnStatusCode: false
        }).then((id) => {
          surveyId = id
        }).then((response) => {
          expect (response.status).to.eq(200)
        })
        //cy.deleteSurvey(surveyId);
      })
    })
  })
    


  describe ("An anonymous user can visit a survey", () => {
    before(() => {
      //user is not logged in
      expect (window.localStorage.length).to.eq(0)
      //console.log(window.localStorage.length)
      //expect (window.localStorage).to.eq()
    })
    
    //beforeEach (() => {
      //cy.intercept("http://localhost:3857/graphql").as('request')
      //cy.intercept("http://localhost:3857/graphql", ((req) => {
      //  //console.log(req.body)
      //  if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
      //    req.alias = "currentProject"
      //  }
      //}))
    //})
    it ('Can visit the survey', () => {
      
      cy.visit('/maldivestest/surveys/11/0')
      cy.get('[name="Begin Survey"]', {timeout:10000} )
      
    })
    it("Doesn't have dropdown with options", () => {
      cy.get('#chevron-down').should('not.exist')
      //cy.get('#chevron-down').click()
    })
    it("Allows the user to move to name input page", () => {
      cy.get('[name="Begin Survey"]').click()
      cy.contains("What is your name?")
    })
    it("Does not allow user to advance without inputting name", () => {
      cy.get('input').should('be.empty')
      cy.get('[title="Next Question"]')
        .should('have.class', 'pointer-events-none')
    })
    it('Allows user to input name and move to next page', () => {
      cy.get('input').type('User One')
      cy.contains('Next').click()
      cy.contains('What is your email address?')
    })
    //it ('Displays the survey start page', () => {
    //  cy.get('[name="Begin Survey"]', {timeout:10000} )
    //  //cy.visit('/maldivestest/surveys/11/0/practice')
    //  //cy.wait('@request')
    //  //cy.wait('@request').its('response').then((resp) => {
    //  //  console.log(resp)
    //  //  //cy.wrap(resp).then(() => {
    //  //  //  expect (resp.statusCode).to.eq(200)
    //  //  //  cy.get('[name="Begin Survey"]', {timeout:10000} )
    //  //  //  //cy.contains('Begin', {timeout:10000})
    //  //  //})
    //  //})
//
    //  //cy.contains('Begin')
    //})

    //it ('User can visit project admin', () => {
    //  cy.visit('/maldivestest/admin')
    //})

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
