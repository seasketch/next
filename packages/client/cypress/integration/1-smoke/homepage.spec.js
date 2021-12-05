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
    cy.contains("SeaSketch");
    devices.forEach((viewport) => {});
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
  it("Has a link to create a new project");
  it("Links to the project listing");
});
