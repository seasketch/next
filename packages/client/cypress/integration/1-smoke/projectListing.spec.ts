import { ProjectAccessControlSetting } from "../../../src/generated/graphql";

describe("Project Listing smoke test", () => {
  describe("Public projects visible to anonymous users", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Public Project One",
          "cy-public",
          ProjectAccessControlSetting.Public,
          true
        ).then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit("/projects");
    });
    after(() => {
      cy.deleteProject("cy-public");
    });
    it("Project listing renders with public project", () => {
      cy.contains("Public Project One");
    });
  });

  describe('User can login and has the option to create a project', () => {
    before(() => {
      cy.login("User 1"); 
      cy.visit("/projects")
    });
    it("Logs in the user", () => {
      cy.get("#user-menu").should("be.visible");
    });
    it("Invites user to create a project from projects page", () => {
      cy.get("#new-project-btn").should("be.visible")
    });
    it("Directs user to new project page and new project form is visible", () => {
      cy.get('#new-project-btn').click()
      cy.url().should('eq', Cypress.config().baseUrl + '/new-project');
      cy.get("#create-project-btn").should("be.visible")
    });
  });
  describe("A logged-in user can create a project", () => {
    beforeEach(() => {
      cy.login("User 1").then((resp) => {
        cy.wrap(resp["access_token"]).as("token")
      });
    });
      it("Allows a user to login", () => {
        cy.get("#user-menu").should("be.visible");
      })
      it("Allows user to create a project", () => {
        cy.createProject(
          "User Project One",
          "cy-user-project",
          ProjectAccessControlSetting.Public,
          true
        ).then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
        cy.visit("/projects")
        cy.contains("User Project One")
      });
    after(() => {
      cy.deleteProject("cy-user-project");
    }); 
  });
});   
  //I am an anon user and I can see public projects
  //I am a signed in user and can create a project
  //I am a signed in user and can set visibility restrictions on my project
  //I am a signed in user and can delete a project
  //I am a signed in user and expect my projects to be listed on the projects page
  //I am a signed in user and clicking on any projects leads me to 
  //Anonymous users cannot see invite-only projects

