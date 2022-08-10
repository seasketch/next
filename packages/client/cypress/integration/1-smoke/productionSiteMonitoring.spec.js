
describe ('Production site monitoring test', () => {
  beforeEach(() => {
    cy.intercept('https://seasketch.auth0.com/oauth/token').as('auth')
  }); 
  before(() => {
    cy.visit("https://next.seasket.ch/");
    cy.contains('SeaSketch');
    cy.get('a').contains('Get started')
      .should('be.visible');
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
  it ('Loads the survey', () => {
    cy.visit('https://next.seasket.ch/cyprod/surveys/127/0');
    cy.contains('Welcome to the Survey');
    cy.get('button')
      .contains('Begin');
    });
});
