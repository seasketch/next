/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting } from "../../../src/generated/graphql";

//const [createProject] = useCreateProjectMutation({
//  refetchQueries: ["SimpleProjectList"],
//});
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

  describe("Admin-only projects are not visible to anonymous users", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Admin Project One",
          "cy-admin",
          ProjectAccessControlSetting.AdminsOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects')
    });
    after(() => {
      cy.deleteProject("cy-admin");
    }); 
    it("Does not render admin-only projects", () => {
      cy.contains("Admin Project One").should("not.exist")
    })
  });

  describe("Invite-only projects are not visible to anonymous users unless changed by admin", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Invite Project One",
          "cy-invite",
          ProjectAccessControlSetting.InviteOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects')
    });
    after(() => {
      cy.deleteProject("cy-invite");
    }); 
    it("Does not render invite-only projects", () => {
      cy.contains("Invite Project One").should("not.exist")
    })
  });

  describe('User can login and projects page renders button to create a project', () => {
    before(() => {
      cy.login("User 1"); 
      cy.visit("/projects")
    });
    it("Logs in the user", () => {
      cy.get("#user-menu").should("be.visible");
    });
    it("Create project button is visible and links to new project form", () => {
      cy.get("#new-project-btn").should("be.visible")
        .get('#new-project-btn').click()
        .url().should('eq', Cypress.config().baseUrl + '/new-project');
      cy.get("#create-project-btn").should("be.visible")
    });
  });

  describe("A logged-in user can create a project", () => {
    beforeEach(() => {
      cy.login("User 1").then((resp) => {
        cy.wrap(resp["access_token"]).as("token")
        console.log("token")
      });
      cy.intercept("http://localhost:3857/graphql", ((req) => {
        if (req.body.operationName && req.body.operationName === "CreateProject") {
          req.alias = "createProject"
        }
        if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
          req.alias = "currentProject"
        }
      }));
    });
    it("Logs in the user", () => {
      cy.get("#user-menu").should("be.visible");
    });
    it("Allows user to create a project", () => {
      cy.visit('/new-project')
        .get('input[id=name]').type('Form Project Two')
        .should('have.value', 'Form Project Two')
      cy.get('input[id=slug]').type('form2')
        .should ('have.value', 'form2')
        //Debounce slug
        .wait(500)
      cy.get('#create-project-btn').click()
      .wait('@createProject')
      .wait('@currentProject')
    });
  });
  
  describe("An unverified user cannot create a project", () => {
    it("A user with an unverified email address cannot login", () => {
      cy.login('Unverified Email')
    })
  })  
});
  
  //**I am an anon user and I can see public projects
  //**I am a signed in user and can create a project
  //I am a signed in user and can set visibility restrictions on my project
  //I am a signed in user and can delete a project
  //**I am a signed in user and expect my projects to be listed on my projects page
  //**I am a signed in user and clicking on any project leads me to project app page
  //**Anonymous users cannot see admin-only projects
  //**Anonymous user cannot see invite-only projects by default */
  //I am a user whose email is unverified