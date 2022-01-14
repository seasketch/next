const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];

describe ("Survey creation smoke test", () => {
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
