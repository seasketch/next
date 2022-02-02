//const createSurvey = `
//        mutation makeSurvey {
//            makeSurvey(input: { projectId: 1441, name: "Maldives Ocean Uses Survey" }) {
//              survey {
//                projectId, 
//                name, 
//                id
//              }
//            }
//          } 
//        `;
//        return cy.request({
//          log: true,
//          url: 'http://localhost:3857/graphql',
//          method: 'POST',
//          headers: {
//              'Content-Type': 'application/json',
//              'Authorization': `Bearer ${access_token}`
//          },
//          body: {
//              query: createSurvey
//          },
//          failOnStatusCode: false
//        }).then((response) => {
//         cy.wrap(response).as("surveyResponse")
//         cy.wrap(response.body.data.makeSurvey.survey.id).as("surveyId")
//        })