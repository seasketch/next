// type definitions for Cypress object "cy"
/// <reference types="cypress" />

const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];

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
  it("Describes the project", () => cy.contains("SeaSketch"));
  it("SeaSketch logo links to root", () => {
    cy.get("[id=seasketch-logo]").click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
  it("Has a link to learn more", () => {
    cy.get("[id=learn-more]").click();
    cy.url().should('eq', Cypress.config().baseUrl + '/team'); 
    cy.visit('/')
  });
  it("Has a link to create a new project", () => {
    cy.get("[id=get-started]").click(); 
    cy.url().should('eq', Cypress.config().baseUrl + '/new-project'); 
    cy.visit('/')
  });

  describe("Large devices", () => {
      devices.slice(0,2).forEach((device) => {
      it(`Links to about page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=nav-about]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/');
      });
      it(`Links to project listings - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=nav-projects]").click(); 
        cy.url().should('eq', Cypress.config().baseUrl + '/projects');
        cy.visit("/");
      });
      it(`Links to api page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=nav-api]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/api');
        cy.visit("/");
      });
      it(`Links to team page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=nav-team]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/team');
        cy.visit("/");
      });
    });
  });
  describe("Mobile devices", () => {
    devices.slice(2).forEach((device) => {
      it(`Has a collapsed navigation menu - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=collapsed-nav]").should("be.visible")
      })
      it(`Links to about page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=collapsed-nav]").click()
        cy.get("[id=modal-nav-about]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/');
      });
      it(`Links to project listings - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=collapsed-nav]").click()
        cy.get("[id=modal-nav-projects]").click(); 
        cy.url().should('eq', Cypress.config().baseUrl + '/projects');
        cy.visit("/");
      });
      it(`Links to api page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=collapsed-nav]").click()
        cy.get("[id=modal-nav-api]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/api');
        cy.visit("/");
      });
      it(`Links to team page - ${device}`, () => {
        cy.viewport(device);
        cy.screenshot({
          capture: "viewport",
        });
        cy.get("[id=collapsed-nav]").click()
        cy.get("[id=modal-nav-team]").click()
        cy.url().should('eq', Cypress.config().baseUrl + '/team');
        //cy.visit("/");
      
      })
    });
    //Signed out user
    //devices.slice(2).forEach((device) => {
    //  it(`Has a link to sign in - ${device}`, () => {
    //    cy.viewport(device);
    //    cy.screenshot({
    //      capture: "viewport",
    //    });
    //    cy.get("[id=collapsed-nav]").then(($nav) => {
    //      cy.wrap($nav).click().then(($menu) => {
    //          cy.wrap($menu).get("[id=modal-sign-in]")
    //      }) 
    //    })
    //  });
    //});
  });
});
