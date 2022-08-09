
describe ('Production site monitoring test', () => {
  beforeEach(() => {
    cy.intercept('https://seasketch.auth0.com/oauth/token').as('auth')
  }); 
  before(() => {
    cy.visit("https://next.seasket.ch/");
    cy.contains('SeaSketch');
    cy.get('a').contains('Get started')
      .should('be.visible');
    cy.contains('Sign In').click();
    cy.get('[id="username"]').type("test_user_1@seasketch.org");
    cy.get('[id="password"]').type("uUGPXmq7iDsh3XA");
    cy.get('[name="action"]').contains('Continue').click();
    cy.get('#user-menu').should('be.visible');
  });
  after(() => {
    cy.visit("https://next.seasket.ch/");
    cy.get('button').then((btn) => {
      if (btn.text().includes('Sign In')) {
        cy.get('button').contains('Sign In')
          .click();
        cy.get('#user-menu')
          .should('be.visible')
          .click();
        cy.contains('Sign out')
          .click();
      } else {
        cy.get('#user-menu')
          .should('be.visible')
          .click();
        cy.contains('Sign out')
          .click();
      }
    });
  });
  it ('Loads the project page', () => {
    cy.get('[id = "nav-projects"]')
      .click();
    cy.url().should('eq', 'https://next.seasket.ch/projects');
    //number of projects on listing page is greater than 1
    let projects = []
    cy.get('li').each(($li) => {
      if ($li.parent().attr('href').includes('app')) {
        projects.push($li.parent().attr('href'))
      }
    }).then(() => {
      expect(projects.length).to.be.gt(1)
    });
  });
  it ('Loads the project', () => {
    cy.contains('Cypress Production Test Project - cyprod')
      .should('be.visible')
      .click();
    cy.contains('cyprod');
    cy.contains('Project Administration')
      .click();
    cy.contains('Basic Settings');
  });
  it ('Loads the survey admin', () => {
    cy.get('a').contains('Surveys').click({force:true});
    cy.contains('Cypress Production Test Survey')
      .click();
    cy.contains('Cypress Production Test Survey');
    cy.contains("https://next.seasket.ch/").click()
  });
  it('Loads the survey', () => {
    cy.contains('Welcome to the Survey');
    cy.get('button')
      .contains('Begin');
  });
});
