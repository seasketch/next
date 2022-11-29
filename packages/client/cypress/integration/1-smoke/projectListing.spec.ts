/* eslint-disable cypress/no-unnecessary-waiting */
import { DeleteProjectInviteDocument, ProjectAccessControlSetting } from "../../../src/generated/graphql";
import { deleteUser } from "../../support/deleteUser.js"
import { getAuth0ApiToken, getAuth0CypressUserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'

let newUser

describe("Project listing smoke test", () => {
  describe("Public projects are visible to anonymous users", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Public Project",
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
      bypassUncaughtException('ServiceWorker')
      cy.contains("Public Project");
    });
  });
  describe("Admin-only projects are not visible to anonymous users", () => {
    before(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProject"
        };
      });
      bypassUncaughtException('ServiceWorker')
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Admin-Only Project",
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
    it("Creates project with correct access control and the project isn't listed on projects page", () => {
      bypassUncaughtException('ServiceWorker')
      cy.wait('@createProject').its('response').then((resp) => {
        expect(resp.body.data.createProject.project.accessControl).to.eq('ADMINS_ONLY')
      });
      //Check if user is anon
      cy.contains('Sign In')
        .should('be.visible');
      cy.contains('Admin-Only Project').should('not.exist');
    });
  });
  describe("Invite-only projects are not visible to anonymous users unless changed by admin", () => {
    before(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressSetAccessControl")) {
          req.alias = "setAccessControl"
        };
      });
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Invite-Only Project",
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
    it("Creates project with correct access control and the project isn't listed on projects page by default", () => {
      cy.wait('@setAccessControl').its('response').then((resp) => {
        expect(resp.body.data.updateProject.project.accessControl).to.eq('INVITE_ONLY')
      });
      cy.contains("Invite-Only Project").should("not.exist");
    });
  });
  describe('User can login and create a project', () => {
    before(() => {
      cy.visit("/projects")
    });
    it('Allows a user to sign in', () => {
      bypassUncaughtException('ServiceWorker')
      cy.contains('Sign In').click();
      cy.get('#username').type('test_user_1@seasketch.org')
      cy.get('#password').type('password');
      cy.contains('Continue').click()
    })
    it("Can create a project", () => {
      const projectSlug = 'cyproject'
      cy.get("[data-cy='button-create-a-project']").should("be.visible")
        .click();
      cy.get('#name').type('Cypress Test Project');
      cy.get('#slug').type(`${projectSlug}`);
      //Debounce slug
      cy.wait(200);
      cy.get('#create-project-btn').click();
      cy.url().should('eq', Cypress.config().baseUrl + `/${projectSlug}/admin`);
      cy.contains('Cypress Test Project')
      
    });
    after(() => {
      cy.deleteProject('cyproject');
      cy.get('button').then((btn) => {
        if(btn.text().includes('Sign Out')) {
          //Sign out button
          cy.get(':nth-child(1) > .mt-5 > .bg-gray-800 > .group.text-gray-300').click()
        } else {
          cy.get('#user-menu').click();
          cy.contains('Sign out').click();
        }
      });
    });
  });
  describe("An unverified user cannot create a project", () => {
    before(() => {
      cy.visit('/projects')
    });
    after(() => {
      cy.get('button').then((btn) => {
        if(btn.text().includes('Sign Out')) {
          //Sign out button
          cy.get(':nth-child(1) > .mt-5 > .bg-gray-800 > .group.text-gray-300').click()
        } else {
          cy.get('#user-menu').click();
          cy.contains('Sign out').click();
        }
      });
      //getAuth0ApiToken().then((resp) => {
      //  const token = resp.access_token;
      //  deleteAllAuth0CypressUsers(token);
      //});
      //cy.deleteUser(newUser);
    });
    it("A new user can create an account and is logged in", () => {
      bypassUncaughtException('ServiceWorker');
      const userSlug = generateSlug();
      newUser = `cypress_user_${userSlug}@seasketch.org`
      cy.get('button').contains('Sign In').click()
      cy.contains('Sign up').click();
      cy.get('#email').type(`${newUser}`);
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      cy.contains('Accept').click();
      cy.get('#user-menu').should('be.visible');
    });
    it('Cannot create a project until email is verified', () => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CreateProject")) {
          req.alias = "createProject"
        };
      });
      getAuth0ApiToken().then((resp) => {
        const token = resp.access_token;
        //getAuth0CypressUserByEmail(newUser, token).then((resp) => {
        //  expect(resp[0].email_verified).to.equal(false);
        //});
      });
      cy.get('[data-cy="button-create-a-project"]').click();
      cy.get('#name').type('Cypress Test Project');
      cy.get('#slug').type('cyproject');
      //Debounce slug
      cy.wait(200);
      cy.get('#create-project-btn').click();
      cy.wait('@createProject').then((req) => {
        expect(req.response.body.errors[0].message).to.equal('Email must be verified to create a project');
      });
      cy.contains('Error: Email must be verified to create a project').
        should('be.visible');
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
    });
  });  
  describe("A user cannot create a project with existing slug", () => {
    before(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProject"
        };
      });
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Admin-Only Project",
          "cyadmin",
          ProjectAccessControlSetting.AdminsOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects');
    });
    after(() => {
      cy.deleteProject("cyadmin");
      cy.get('button').then((btn) => {
        if(btn.text().includes('Sign Out')) {
          //Sign out button
          cy.get(':nth-child(1) > .mt-5 > .bg-gray-800 > .group.text-gray-300').click()
        } else {
          cy.get('#user-menu').click();
          cy.contains('Sign out').click();
        }
      });
    });
    it("Allows navigate to create project form but cannot create project with existing slug", () => {
      bypassUncaughtException('ServiceWorker');
      cy.contains('Sign In').click();
      cy.get('#username').type('test_user_1@seasketch.org')
      cy.get('#password').type('password');
      cy.contains('Continue').click()
      cy.get("#user-menu").should("be.visible");
      cy.get("[data-cy='button-create-a-project']").should("be.visible")
        .click();
      cy.get('#name').type("Admin-Only Project");
      cy.get('#slug').type("cy-admin");
      //Debounce slug
      cy.wait(200);
      cy.get('#create-project-btn').click();
      cy.contains('This URL is already in use')
        .should('be.visible');
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
    });
  });
  describe("An authenticated user can view their own projects", () => {
    beforeEach(() => {
      bypassUncaughtException('ServiceWorker');
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProject"
        };
        if ((req.body.operationName) && (req.body.operationName === "SimpleProjectList")) {
          req.alias = "projectList"
        };
        if ((req.body.operationName) && (req.body.operationName === "CypressSetAccessControl")) {
          req.alias = "setAccessControl"
        };
      });
    })
    after(() => {
      cy.deleteProject("cy-admin");
      cy.deleteProject("cy-invite");
    }); 
    it("Allows a user to create an admin-only and invite-only project", () => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Admin-Only Project",
          "cy-admin",
          ProjectAccessControlSetting.AdminsOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
        cy.createProject(
          "Invite-Only Project",
          "cy-invite",
          ProjectAccessControlSetting.InviteOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.wait('@createProject').its('response').then((resp) => {
        expect(resp.body.data.createProject.project.admins[0].canonicalEmail).to.equal('test_user_1@seasketch.org');
      });
      cy.wait('@setAccessControl').its('response').then((resp) => {
        expect(resp.body.data.updateProject.project.admins[0].canonicalEmail).to.equal('test_user_1@seasketch.org');
      });
    });
    it("Shows the project(s) when user is logged in", () => {
      cy.visit('/projects');
      cy.contains('Admin-Only Project').should('not.exist');
      cy.contains('Invite-Only Project').should('not.exist')
      cy.login('User 1');
      cy.reload();
      cy.wait('@projectList').its('response.statusCode').should('equal', 200)
      cy.get('#user-menu').should('be.visible');
      cy.contains('Admin-Only Project');
      cy.contains('Invite-Only Project');
    });
  });
});
