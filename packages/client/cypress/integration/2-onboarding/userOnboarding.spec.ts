/* eslint-disable cypress/no-unnecessary-waiting */
import { ParticipantSortBy, ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { deleteUser } from "../../support/deleteUser.js"
import { getAuth0ApiToken, getAuth0UserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'
import { mkdirSync } from "fs";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fs = require('fs');

const projectOptions = ["public","inviteOnly","adminsOnly"];


const projectDetails = 
  {"inviteOnly": {
    "name": "Cypress Invite-Only Project",
    "slug": "cy-invite-only", 
    "accessControl": ProjectAccessControlSetting.InviteOnly
    },
    "adminsOnly": {
      "name": "Cypress Admin-Only Project",
      "slug": "cy-admin-only",
      "accessControl": ProjectAccessControlSetting.AdminsOnly
    },
    "public": {
      "name": "Cypress Public Project", 
      "slug": "cy-public", 
      "accessControl": ProjectAccessControlSetting.Public
    }
  }

let newUser; 

describe("User onboarding via independent browsing", () => {
  describe.only('Unauthenticated new user visiting an invite-only project', () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails.inviteOnly.name}`,
          `${projectDetails.inviteOnly.slug}`,
          ProjectAccessControlSetting.InviteOnly,
          true
        ); 
      });
    });
    after(() => {
      getAuth0ApiToken().then((resp) => {
        //cy.log(resp)
        const token = resp.access_token;
        deleteAllAuth0CypressUsers(token);
      });
      cy.deleteProject(`${projectDetails.inviteOnly.slug}`)
    });
    it('Visits the project homepage', () => {
      bypassUncaughtException('ServiceWorker');
      cy.visit('/');
      cy.get('a#nav-projects').click();
    });
    it('Should be prompted to sign in or create an account', () => {
      const userSlug = generateSlug();
      newUser = `cypress_user_${userSlug}@seasketch.org`
      cy.contains('Cypress Invite-Only').click();
      cy.contains('Create an account')
        .should('be.visible');
      cy.get('button').contains('Sign in').click()
      cy.contains('Sign up').click();
      cy.get('#email').type(`${newUser}`);
      cy.get('#password').type('password');
      cy.contains('Continue').click();
    });
    it('Should be prompted to share profile and request access', () => {
      cy.contains('Accept').click()
      cy.contains('Share Profile', {timeout:10000});
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
    });
  });
  describe('Unauthenticated returning participant visiting an invite-only project', () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressApproveParticipant")) {
          req.alias = "approveParticipant"
        };
      });
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails.inviteOnly.name}`,
          `${projectDetails.inviteOnly.slug}`,
          ProjectAccessControlSetting.InviteOnly,
          true
        ).then((id) => {
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token)
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      cy.deleteProject(`${projectDetails.inviteOnly.slug}`)
    });
    it('Visits the project homepage and project exists', () => {
      bypassUncaughtException('ServiceWorker');
      cy.visit('/');
      cy.get('a#nav-projects').click();
      cy.contains('Cypress Invite-Only');
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
      cy.contains('Sign in');
    });
    it('Is an approved participant', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          cy.getToken('User 2').then(({access_token}) => {
            const projectId = parseInt(id)
            //second arg is token for user being added to project
            cy.joinProject(projectId, access_token).then((resp) => {
              const newParticipantId = resp.joinProject.query.project.unapprovedParticipants[0].id
              //second arg is user_id for user 2 (participant)
              //third arg is token for user 1 (project administrator)
              cy.approveParticipant(projectId, newParticipantId, token);
              cy.wait('@approveParticipant').its('response').then((resp) => {
                const project = resp.body.data.approveParticipant.query.project
                let participants = []
                project.participants.forEach((t) => {
                  participants.push(t.canonicalEmail);
                });
                cy.log(`${participants}`)
                expect (participants).to.include('test_user_2@seasketch.org');
              });
            });
          });
        });
      }); 
    });
    it('Should be prompted to sign in when approved participant returns to project', () => {
      cy.visit('/projects');
      cy.contains('Cypress Invite-Only').click();
      cy.get('button').contains('Sign in').should('be.visible');
      cy.get('button').contains('Sign in').click(); 
      cy.get('#username').type('test_user_2@seasketch.org')
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      //project participant is redirected to project app page after signing in
      cy.contains('Cypress Invite-Only')
        .should('be.visible');
      cy.url().should('eq', Cypress.config().baseUrl + `/${projectDetails.inviteOnly.slug}/app`);
    });
  });
  describe("Unauthenticated returning user visiting an admin-only project as an admin", () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProject"
        };
      });
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails.adminsOnly.name}`,
          `${projectDetails.adminsOnly.slug}`,
          ProjectAccessControlSetting.AdminsOnly,
          true
        ).then((projectId) => {
          cy.setLocalStorage('projectId', projectId as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      cy.deleteProject(`${projectDetails.adminsOnly.slug}`);
    });
    it('Visits the project app page and is not granted access', () => {
      cy.restoreLocalStorage();
      cy.visit(`/${projectDetails.adminsOnly.slug}/app`);
      cy.contains('Private Project')
        .should('be.visible')
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
      cy.contains('Cypress Admin-Only Project');
    });
    it('Is a project administrator', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          const projectId = parseInt(id);
          cy.getProject(projectId, token).then((resp) => {
            const project = resp.query.project;
            expect (project.name).to.eq('Cypress Admin-Only Project');
            expect (project.accessControl).to.eq('ADMINS_ONLY');
            expect (resp.query.project.admins[0].canonicalEmail).to.eq('test_user_1@seasketch.org')
          });
        });
      });
    });
    it('Is prompted to sign in and can access project', () => {
      cy.contains('Cypress Admin-Only').click();
      cy.contains('Private Project');
      cy.contains('project administrators');
      cy.contains('Cypress Admin-Only')
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('test_user_1@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      cy.url().should('equal', Cypress.config().baseUrl + '/cy-admin-only/app')
      cy.contains('Cypress Admin-Only');
      cy.contains('test_user_1@seasketch.org');
      cy.contains('Project Admin Dashboard');
    });
  });
  describe("Unauthenticated returning user visiting an admin-only project as a non-admin user", () => {
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProject")) {
          req.alias = "createProject"
        };
        if ((req.body.operationName) && (req.body.operationName === "UserIsSuperuser")) {
          req.alias = "userIsSuperuser"
        };
      });
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails.adminsOnly.name}`,
          `${projectDetails.adminsOnly.slug}`,
          ProjectAccessControlSetting.AdminsOnly,
          true
        ).then((projectId) => {
          cy.setLocalStorage('projectId', projectId as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      cy.deleteProject(`${projectDetails.adminsOnly.slug}`);
    });
    it('Visits the project app page and is not granted access', () => {
      bypassUncaughtException('ServiceWorker');
      cy.restoreLocalStorage();
      cy.visit(`/${projectDetails.adminsOnly.slug}/app`);
      cy.contains('Private Project')
        .should('be.visible')
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
      cy.contains('Cypress Admin-Only Project');
    });
    it('Is not a project administrator', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          const projectId = parseInt(id);
          cy.getProject(projectId, token).then((resp) => {
            const project = resp.query.project;
            expect (project.name).to.eq('Cypress Admin-Only Project');
            expect (project.accessControl).to.eq('ADMINS_ONLY');
            expect (project.admins[0].canonicalEmail).to.not.include('test_user_2@seasketch.org');
          });
        });
      });
    });
    it('Is prompted to sign in and can access project', () => {
      cy.contains('Cypress Admin-Only').click();
      cy.contains('Private Project');
      cy.contains('project administrators');
      cy.contains('Cypress Admin-Only')
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('test_user_2@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      cy.url().should('equal', Cypress.config().baseUrl + '/cy-admin-only/app'); 
      //cy.get('span')//.contains('authenticating').should('not.exist')
      cy.wait('@userIsSuperuser')
      cy.contains('Admins Only')
        .should('be.visible', {timeout:10000});
      cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
      cy.contains('Cypress Admin-Only');
      cy.contains('test_user_1@seasketch.org');
    });
  });
});

describe('User onboarding via email invites', () => {
  projectOptions.forEach((projectOption) => {
    if (projectDetails[projectOption]) {
      describe(`A new user receiving an invitation to a(n) ${projectOption} project`, () => {
        beforeEach(() => {
          cy.intercept("http://localhost:3857/graphql", (req) => {
            if ((req.body.operationName) && (req.body.operationName === "CypressCreateProjectInvites")) {
              req.alias = "createProjectInvites"
            };
            if ((req.body.operationName) && (req.body.operationName === "VerifyProjectInvite")) {
              req.alias = "verifyProjectInvite"
            };
            if ((req.body.operationName) && (req.body.operationName === "ConfirmProjectInvite")) {
              req.alias = "confirmProjectInvite"
            };
          });
        });
        before(() => {
          const userSlug = generateSlug();
          newUser = `cypress_user_${userSlug}@seasketch.org`
          cy.getToken("User 1").then(({ access_token }) => {
            cy.wrap(access_token).as("token");
            cy.setLocalStorage("token", access_token);
            cy.createProject(
              `${projectDetails[projectOption].name}`,
              `${projectDetails[projectOption].slug}`,
              projectDetails[projectOption].accessControl,
              true
            ).then((id) => {
              cy.setLocalStorage('projectId', id as any);
              cy.setLocalStorage('token', access_token);
              cy.saveLocalStorage();
            })
          });
        });
        after(() => {
          bypassUncaughtException('ServiceWorker');
          cy.deleteProject(`${projectDetails[projectOption].slug}`);
        });
        it('Creates a project invite with correct project name and sign-up link', () => {
          bypassUncaughtException('ServiceWorker');
          cy.restoreLocalStorage();
          let options
          if (projectOption === "admins-only") {
            //sets sendEmailNow and makeAdmin to true for adminsOnly projects
            options = [`${newUser}`, true, true];
          } else {
            //sets sendEmailNow to true, makeAdmin to false
            options = [`${newUser}`, true, false];
          }
          cy.getLocalStorage('projectId').then((id) => {
            const projectId = parseInt(id);
            cy.getLocalStorage('token').then((token) => {
              cy.createProjectInvites(projectId, options, token).then((resp) => {
                const respData = resp.createProjectInvites
                //check that the project has the correct accessControl
                expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
                const projectInvites = resp.createProjectInvites.projectInvites
                expect (projectInvites.length).to.be.gte(1);
                expect (projectInvites[0].email).to.eq(options[0]);
                expect (projectInvites[0].projectId).to.eq(projectId);
                cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
                  const textAry = txt.split("\n");
                  const inviteUrl = textAry.find(element => element.includes('https'));
                  expect (txt).to.include(`Destination: ${newUser}`);
                  expect (txt).to.include(projectDetails[projectOption].name);
                  expect (txt).to.include('token');
                  let urlAry = inviteUrl.split('/');
                  urlAry.splice(0,3, Cypress.config().baseUrl);
                  cy.visit(urlAry.join('/'));
                  cy.wait('@verifyProjectInvite').its('response').then((resp) => {
                    expect(resp.body.data.verifyProjectInvite.existingAccount).to.equal(false);
                    expect (resp.statusCode).to.eq(200);
                    expect (resp.body.data.verifyProjectInvite.error).to.eq(null);
                  });
                });
              });
            });
          });
        });
        it('Leads to invite landing page, prompting the user to sign in or create an account', () => {
          cy.contains(`${projectDetails[projectOption].name}`)
            .should('be.visible');
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.get('[data-cy="button-sign-in"]')
            .should('be.visible');
          cy.get('[data-cy="button-create-an-account"]')
            .should('be.visible');
        });
        it('Prompts new user to join project after creating an account', () => {
          cy.get('[data-cy="button-create-an-account"]')
            .should('be.visible')
            .click();
          cy.get('#email')
            .should('have.value', `${newUser}`);
          cy.get('#password').type('password');
          cy.contains('Continue').click();
          cy.contains('Accept').click();
          cy.wait('@confirmProjectInvite');
          cy.contains(`${projectDetails[projectOption].name}`);
          cy.contains('Join Project')
            .should('be.visible');
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.contains('Skip for now');
        });
      });
    };
  });
  projectOptions.forEach((projectOption) => {
    if (projectDetails[projectOption]) {
      describe(`An unauthenticated returning user receiving an invitation to a listed, ${projectOption} project`, () => {
        beforeEach(() => {
          cy.intercept("http://localhost:3857/graphql", (req) => {
            if ((req.body.operationName) && (req.body.operationName === "CypressCreateProjectInvites")) {
              req.alias = "createProjectInvites"
            };
            if ((req.body.operationName) && (req.body.operationName === "VerifyProjectInvite")) {
              req.alias = "verifyProjectInvite"
            };
            if ((req.body.operationName) && (req.body.operationName === "ConfirmProjectInvite")) {
              req.alias = "confirmProjectInvite"
            };
            if (((req.body.operationName) && (req.body.operationName === "ProjectRegion"))) {
              req.alias = "getProjectRegion"
            };
          });
        });
        before(() => {
          cy.getToken("User 1").then(({ access_token }) => {
            cy.wrap(access_token).as("token");
            cy.setLocalStorage("token", access_token);
            cy.createProject(
              `${projectDetails[projectOption].name}`,
              `${projectDetails[projectOption].slug}`,
                projectDetails[projectOption].accessControl,
              true
            ).then((id) => {
              cy.setLocalStorage('projectId', id as any);
              cy.setLocalStorage('token', access_token);
              cy.saveLocalStorage();
            })
          });
        });
        after(() => {
          bypassUncaughtException('ServiceWorker');
          cy.deleteProject(`${projectDetails[projectOption].slug}`);
        });
        it('Creates a project invite with correct project name and sign-up link', () => {
          bypassUncaughtException('ServiceWorker');
          cy.restoreLocalStorage();
          //recipient email, sendEmailNow, makeAdmin
          const options = ['test_user_2@seasketch.org', true, false];
          cy.getLocalStorage('projectId').then((id) => {
            const projectId = parseInt(id);
            cy.getLocalStorage('token').then((token) => {
              cy.createProjectInvites(projectId, options, token).then((resp) => {
                const respData = resp.createProjectInvites
                //check that the project has the correct accessControl and is public
                expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
                if (projectOption === "inviteOnly" || projectOption === "public") {
                  expect (respData.query.project.isListed).to.equal(true);
                } else {
                  cy.updateProject(projectId, token, ["isListed", "true"]).then((data) => {
                    expect(data.updateProject.project.isListed).to.equal(true)
                  });
                }
                const projectInvites = resp.createProjectInvites.projectInvites;
                expect (projectInvites.length).to.eq(1);
                expect (projectInvites[0].email).to.eq(options[0]);
                expect (projectInvites[0].projectId).to.eq(projectId);
                //wait for file write to finish 
                cy.wait(1000)
                cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
                  const textAry = txt.split("\n");
                  const inviteUrl = textAry.find(element => element.includes('https'));
                  expect (txt).to.include(`Destination: test_user_2@seasketch.org`);
                  expect (txt).to.include(projectDetails[projectOption].name);
                  expect (txt).to.include('token');
                  let urlAry = inviteUrl.split('/');
                  urlAry.splice(0,3, Cypress.config().baseUrl);
                  cy.visit(urlAry.join('/'));
                  cy.wait('@verifyProjectInvite').its('response').then((resp) => {
                    expect(resp.body.data.verifyProjectInvite.existingAccount).to.equal(true);
                    expect(resp.body.data.verifyProjectInvite.claims.email).to.equal('test_user_2@seasketch.org');
                    expect(resp.statusCode).to.eq(200);
                    expect(resp.body.data.verifyProjectInvite.error).to.eq(null);
                  });
                });
              });
            });
          });
        });
        it('Leads to invite landing page, prompting the user to sign in or create an account', () => {
          cy.contains(`${projectDetails[projectOption].name}`)
            .should('be.visible')
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.get('[data-cy="button-create-an-account"]')
            .should('be.visible');
          cy.get('[data-cy="button-sign-in"]')
            .should('be.visible')
            .click();
        });
        it('Prompts user to join project after signing in', () => {
          cy.get('#username')
            .should('have.value', 'test_user_2@seasketch.org');
          cy.get('#password').type('password');
          cy.contains('Continue').click();
          cy.wait('@confirmProjectInvite');
          cy.contains(`${projectDetails[projectOption].name}`);
          cy.contains('Skip for now')
            .should('be.visible');
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.get('[name="fullname"]')
            .clear()
            .type('Test User 2');
          cy.contains('Join Project').click();
          cy.wait('@getProjectRegion')
          cy.contains(projectDetails[projectOption].name)
        });
      });
    }   
  });
  projectOptions.forEach((projectOption) => {
    //public projects cannot be unlisted
    if (projectOption !== "public") {
      describe(`An unauthenticated returning user receiving an invitation to an unlisted, ${projectOption} project`, () => {
        beforeEach(() => {
          cy.intercept("http://localhost:3857/graphql", (req) => {
            if ((req.body.operationName) && (req.body.operationName === "CypressCreateProjectInvites")) {
              req.alias = "createProjectInvites"
            };
            if ((req.body.operationName) && (req.body.operationName === "VerifyProjectInvite")) {
              req.alias = "verifyProjectInvite"
            };
            if ((req.body.operationName) && (req.body.operationName === "ConfirmProjectInvite")) {
              req.alias = "confirmProjectInvite"
            };
            if (((req.body.operationName) && (req.body.operationName === "ProjectRegion"))) {
              req.alias = "getProjectRegion"
            };
            if (((req.body.operationName) && (req.body.operationName === "JoinProject"))) {
              req.alias = "joinProject"
            };
            if (((req.body.operationName) && (req.body.operationName === "UpdateProfile"))) {
              req.alias = "updateProfile"
            };
          });
        });
        before(() => {
          cy.getToken("User 1").then(({ access_token }) => {
            cy.wrap(access_token).as("token");
            cy.setLocalStorage("token", access_token);

            cy.createProject(
              `${projectDetails[projectOption].name}`,
              `${projectDetails[projectOption].slug}`,
              projectDetails[projectOption].accessControl,
              false
            ).then((id) => {
              cy.setLocalStorage('projectId', id as any);
              cy.setLocalStorage('token', access_token);
              cy.saveLocalStorage();
            })
          });
        });
        after(() => {
          bypassUncaughtException('ServiceWorker');
          cy.deleteProject(`${projectDetails[projectOption].slug}`);
        });
        it('Creates a project invite with correct project name and sign-up link', () => {
          bypassUncaughtException('ServiceWorker');
          cy.restoreLocalStorage();
          let options
          if (projectOption === "adminsOnly") {
            //sets sendEmailNow and makeAdmin to true for adminsOnly projects
            options = ['test_user_2@seasketch.org', true, true];
          } else {
            //sets sendEmailNow to true, makeAdmin to false
            options = ['test_user_2@seasketch.org', true, false];
          }
          cy.getLocalStorage('projectId').then((id) => {
            const projectId = parseInt(id);
            cy.getLocalStorage('token').then((token) => {
              cy.createProjectInvites(projectId, options, token).then((resp) => {
                const respData = resp.createProjectInvites
                //check that the project has the correct accessControl and is public
                expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
                expect (respData.query.project.isListed).to.equal(false);
                const projectInvites = resp.createProjectInvites.projectInvites;
                expect (projectInvites.length).to.gte(1);
                expect (projectInvites[0].email).to.eq(options[0]);
                expect (projectInvites[0].projectId).to.eq(projectId);
                //wait for file write to finish 
                cy.wait(1000)
                cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
                  const textAry = txt.split("\n");
                  const inviteUrl = textAry.find(element => element.includes('https'));
                  expect (txt).to.include(`Destination: test_user_2@seasketch.org`);
                  expect (txt).to.include(projectDetails[projectOption].name);
                  expect (txt).to.include('token');
                  let urlAry = inviteUrl.split('/');
                  urlAry.splice(0,3, Cypress.config().baseUrl);
                  cy.visit(urlAry.join('/'));
                  cy.wait('@verifyProjectInvite').its('response').then((resp) => {
                    // TO DO
                    //expect(resp.body.data.verifyProjectInvite.existingAccount).to.equal(true);
                    expect(resp.body.data.verifyProjectInvite.claims.email).to.equal('test_user_2@seasketch.org');
                    expect(resp.body.data.verifyProjectInvite.error).to.eq(null);
                    if (projectOption === 'adminsOnly') {
                      expect(resp.body.data.verifyProjectInvite.claims.admin).to.equal(true);
                    } else {
                      expect(resp.body.data.verifyProjectInvite.claims.admin).to.equal(false);
                    }
                  });
                });
              });
            });
          });
        });
        it('Leads to invite landing page, prompting the user to sign in or create an account', () => {
          cy.contains(`${projectDetails[projectOption].name}`);
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.get('[data-cy="button-create-an-account"]')
            .should('be.visible');
          cy.get('[data-cy="button-sign-in"]')
            .should('be.visible')
            .click();
        });
        it('Prompts user to join project after signing in', () => {
          cy.get('#username')
            .should('have.value', 'test_user_2@seasketch.org');
          cy.get('#password').type('password');
          cy.contains('Continue').click();
          cy.wait('@confirmProjectInvite').its('response.statusCode').should('eq', 200);
          cy.contains(`${projectDetails[projectOption].name}`);
          cy.contains('Skip for now')
            .should('be.visible')
          cy.get('[name="fullname"]')
            .clear()
            .type('Test User 2');
          bypassUncaughtException('ServiceWorker');
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.contains('Join Project').click();
          cy.wait('@joinProject').its('response.statusCode').should('eq', 200);
          cy.contains("My Profile").should('be.visible', {timeout: 10000})
          cy.contains(projectDetails[projectOption].name);
          cy.contains('Sign Out').click()
        });
      });
    };
  });
  describe('A user with two SeaSketch accounts accepting an invite', () => {
    const projectOption = 'public'
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProjectInvites")) {
          req.alias = "createProjectInvites"
        };
        if ((req.body.operationName) && (req.body.operationName === "VerifyProjectInvite")) {
          req.alias = "verifyProjectInvite"
        };
      });
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails[projectOption].name}`,
          `${projectDetails[projectOption].slug}`,
          projectDetails[projectOption].accessControl,
          true
        ).then((id) => {
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      bypassUncaughtException('ServiceWorker');
      cy.deleteProject(`${projectDetails[projectOption].slug}`);
    });
    it('Creates a project invite', () => {
      bypassUncaughtException('ServiceWorker');
      cy.restoreLocalStorage();
      let options = ['test_user_1@seasketch.org', true, false];
      cy.getLocalStorage('projectId').then((id) => {
        const projectId = parseInt(id);
        cy.getLocalStorage('token').then((token) => {
          cy.createProjectInvites(projectId, options, token).then((resp) => {
            const respData = resp.createProjectInvites
            //check that the project has the correct accessControl and is public
            expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
            expect (respData.query.project.isListed).to.equal(true);
            const projectInvites = resp.createProjectInvites.projectInvites;
            expect (projectInvites.length).to.gte(1);
            expect (projectInvites[0].email).to.eq(options[0]);
            expect (projectInvites[0].projectId).to.eq(projectId);
          });
        });
      });
    });
    it('Prompts signed-in user to accept invite or logout and sign in to recipient account', () => {
      cy.login('User 2');
      cy.visit('/'); 
      cy.get('#user-menu').click(); 
      cy.contains('test_user_2@seasketch.org');
      cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
        const textAry = txt.split("\n");
        const inviteUrl = textAry.find(element => element.includes('https'));
        expect (txt).to.include(`Destination: test_user_1@seasketch.org`);
        expect (txt).to.include(projectDetails[projectOption].name);
        expect (txt).to.include('token');
        let urlAry = inviteUrl.split('/');
        urlAry.splice(0,3, Cypress.config().baseUrl);
        cy.visit(urlAry.join('/'));
        cy.wait('@verifyProjectInvite').its('response').then((resp) => {
          expect(resp.body.data.verifyProjectInvite.claims.email).to.equal('test_user_1@seasketch.org');
          expect(resp.body.data.verifyProjectInvite.error).to.eq(null);
          cy.contains('This invitation was originally sent to test_user_1@seasketch.org')
            .should('be.visible');
          cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
          cy.contains('Logout and sign in');
          cy.contains('Accept as test_user_2@seasketch.org');
        });
      });
    });
  }); 
  describe('A user accepting an expired invite', () => {
    const projectOption = 'public'
    beforeEach(() => {
      cy.intercept("http://localhost:3857/graphql", (req) => {
        if ((req.body.operationName) && (req.body.operationName === "CypressCreateProjectInvites")) {
          req.alias = "createProjectInvites"
        };
        if ((req.body.operationName) && (req.body.operationName === "VerifyProjectInvite")) {
          req.alias = "verifyProjectInvite"
        };
      });
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails[projectOption].name}`,
          `${projectDetails[projectOption].slug}`,
          projectDetails[projectOption].accessControl,
          true
        ).then((id) => {
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      bypassUncaughtException('ServiceWorker');
      cy.deleteProject(`${projectDetails[projectOption].slug}`);
    });
    it('Creates a project invite with expired token', () => {
      bypassUncaughtException('ServiceWorker');
      cy.restoreLocalStorage();
      //By using test_user_3@seasketch.org, along with the IS_CYPRESS_TESTING_ENV variable, api knows to pass an 
      //expired token to createToken in projectInvites.ts
      let options = ['test_user_3@seasketch.org', true, false];
      cy.getLocalStorage('projectId').then((id) => {
        const projectId = parseInt(id);
        cy.getLocalStorage('token').then((token) => {
          cy.createProjectInvites(projectId, options, token).then((resp) => {
            const respData = resp.createProjectInvites
            //check that the project has the correct accessControl and is public
            expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
            expect (respData.query.project.isListed).to.equal(true);
            const projectInvites = resp.createProjectInvites.projectInvites;
            expect (projectInvites.length).to.gte(1);
            expect (projectInvites[0].email).to.eq(options[0]);
            expect (projectInvites[0].projectId).to.eq(projectId);
            //wait for file write to finish 
            cy.wait(1000)
            cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
              const textAry = txt.split("\n");
              const inviteUrl = textAry.find(element => element.includes('https'));
              expect (txt).to.include(`Destination: ${options[0]}`);
              expect (txt).to.include(projectDetails[projectOption].name);
              expect (txt).to.include('token');
              let urlAry = inviteUrl.split('/');
              urlAry.splice(0,3, Cypress.config().baseUrl);
              cy.visit(urlAry.join('/'));
              cy.wait('@verifyProjectInvite').its('response').then((resp) => {
                expect(resp.body.data.verifyProjectInvite).to.haveOwnProperty('error', 'jwt expired');
                cy.percySnapshot(`${Cypress.currentTest.titlePath}`);
                cy.contains('Your invitation to this project has expired')
              });
            });
          });
        });
      });
    });
  }); 
});