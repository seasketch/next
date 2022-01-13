describe ("Survey creation smoke test", () => {
  describe ("User can visit survey", () => {
    it ('Visits the homepage', () => {
      cy.visit('/')
      cy.contains('SeaSketch')
    })
    it ('Logs in the user', () => {
      cy.login('User 1')
      cy.visit('/projects')
      cy.get("#user-menu").should("be.visible");
    })
    it ('Contains the project', () => {
      cy.contains('Maldives Testing').click()
      cy.contains('Maldives Testing')
    }) 
    it ('Can visit the survey', () => {
      cy.visit('/maldivestest/surveys/11/0/practice')
    })
    //it ('User can visit project admin', () => {
    //  cy.visit('/maldivestest/admin')
    //})

  })
})

//A user can visit homepage
//A user can sign in
//A user can create a project
//A user can visit project admin
//A user can visit surveys page
//A user can create a survey
//A user can visit survey admin page
//A user can modify survey
//A user can take survey and data is saved appropriately
