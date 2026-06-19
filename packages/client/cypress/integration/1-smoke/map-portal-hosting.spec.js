// type definitions for Cypress object "cy"
/// <reference types="cypress" />

const devices = ["macbook-15", "ipad-2", "iphone-x", "iphone-5"];

/**
 * Given I am an anonymous user
 * When I visit the Map Portal Hosting use case page (on desktop or mobile)
 * Then I see key marketing content
 * And the page does not introduce horizontal overflow
 */
describe("Map Portal Hosting use case page", () => {
  devices.forEach((device) => {
    it(`renders key content without horizontal overflow - ${device}`, () => {
      cy.viewport(device);
      cy.visit("/uses/map-portal-hosting");
      cy.contains("living map");
      cy.contains("Fast, beautiful maps");
      cy.contains("Additional Features");
      cy.get("main").should("exist");
      cy.document().then((doc) => {
        const scrollWidth = doc.documentElement.scrollWidth;
        const innerWidth = doc.documentElement.clientWidth;
        expect(scrollWidth).to.be.at.most(innerWidth + 1);
      });
      cy.screenshot({
        capture: "fullPage",
      });
    });
  });
});
