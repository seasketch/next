describe("Signing into the app", () => {
  before(() => {
    cy.login("User 1");
    cy.visit("/projects");
  });
  it("Logs in the user", () => {
    cy.get("#user-menu").should("be.visible");
  });
});
