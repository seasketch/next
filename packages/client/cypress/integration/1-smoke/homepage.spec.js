// type definitions for Cypress object "cy"
/// <reference types="cypress" />

const devices = ["macbook-15", "iphone-x", "iphone-5", "ipad-2"];

/**
 * Given I am an anonymous user
 * When I visit the SeaSketch homepage (on desktop or mobile)
 * Then I see content describing the project
 * And an option to Sign In
 */
describe("Homepage smoke test", () => {
  before(() => {
    cy.visit("/");
  });
  it("SeaSketch homepage renders", () => {
    cy.get("[id=seasketch-logo]");
    devices.forEach((viewport) => {});
  });
  it("SeaSketch logo links to root", () => {
    cy.get("[id=seasketch-logo]").click();
    //cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
  it("Links to about page", () => {
    cy.get("[id=nav-about]")
  });
  it("Links to project listings", () => {
    cy.get("[id=nav-projects]")
  });
  it("Links to api page", () => {
    cy.get("[id=nav-api]")
  });
  it("Links to team page", () => {
    cy.get("[id=nav-team]")
  });
  it("Describes the project", () => cy.contains("SeaSketch"));
  devices.forEach((device) => {
    it(`Shows an option to sign in - ${device}`, () => {
      cy.viewport(device);
      cy.screenshot({
        capture: "viewport",
      });
      cy.get("[title='Sign In']").should("be.visible");
    });
  });
  it("Has a link to learn more", () => {
    cy.get("[id=learn-more]").click(); 
    //cy.url().should('eq', Cypress.config().baseUrl + '/team');
    //cy.visit("/");
  });
  it("Has a link to create a new project", () => {
    cy.get("[id=get-started]").click(); 
    //cy.url().should('eq', Cypress.config().baseUrl + '/new-project');
    //cy.visit("/")
  });
  
  //it("Links to the project listing", () => cy.get("[id=projects]"));
});
