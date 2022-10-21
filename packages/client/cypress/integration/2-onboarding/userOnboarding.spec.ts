/* eslint-disable cypress/no-unnecessary-waiting */
import { ParticipantSortBy, ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { deleteUser } from "../../support/deleteUser.js"
import { getAuth0ApiToken, getAuth0CypressUserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug } from '../../support/utils.js'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fs = require('fs');

const projectOptions = ["public"]//, "invite-only", "admins-only"];

const projectDetails = 
  {"invite-only": {
    "name": "Cypress Invite-Only Project",
    "slug": "cy-invite-only", 
    "accessControl": ProjectAccessControlSetting.InviteOnly
    },
    "admins-only": {
      "name": "Cypress Admin-Only Project",
      "slug": "admin-only",
      "accessControl": ProjectAccessControlSetting.AdminsOnly
    },
    "public": {
      "name": "Cypress Public Project", 
      "slug": "cy-public", 
      "accessControl": ProjectAccessControlSetting.Public
    }
  }

const slug = generateSlug();

let newUser; 

const users = require("../../fixtures/users.json");

describe ("User onboarding via independent browsing", () => {
  describe ("Unauthenticated user visiting a public project", () => {
    beforeEach(() => {
        cy.window().then((window) => {
          window.sessionStorage.clear();
          window.localStorage.clear();
          console.log(window.caches)
        });
      cy.clearLocalStorage()
      cy.clearCookies()
      cy.intercept('/service-worker.js').as('serviceWorker')
    })
    before(() => Cypress.automation(
      'remote:debugger:protocol', 
      { 
        command: 'Network.setCacheDisabled',
        params: { cacheDisabled: true }
      }
    ))
    before (() => {
      
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `Cypress Public Project`,
          'cy-public',
          ProjectAccessControlSetting.Public,
          true
        )
        .then((projectId) => { 
          
        }
        )
    })
  })
  after(() => {
    cy.deleteProject('cy-public')
    cy.deleteUser(`cypress_${slug}@seasketch.org`)
  })
    it('Visits the project homepage', () =>{
      Cypress.on('uncaught:exception', (err, runnable) => {
        // we expect a 3rd party library error with message 'list not defined'
        // and don't want to fail the test so we return false
        if (err.message.includes('ServiceWorker')) {
          return false
        }
        // we still want to ensure there are no other unexpected
        // errors, so we let them fail the test
      })
      cy.visit('/')
      //cy.contains('Maldives Testing').click()
      cy.get('a#nav-projects').click()

      cy.wait('@serviceWorker')//.its('response.statusCode').should('equal', 304)
      //cy.contains('SeaSketch')
      //  .should('be.visible')
      
    })
    it ('Should be prompted to share profile information', () => {
      cy.contains("Cypress").click()
      ////cy.deleteUser('anon@seasketch.org')
      cy.contains("Sign In")
        .should('be.visible')
        .click(); 
      
      
      //cy.get('a').then((a) => {
      //  if (a.text().includes('Sign up')) {
          cy.contains('Sign up')
            .click();
          cy.get('#email')
            .clear()
            .type(`cypress_${slug}@seasketch.org`);
          cy.get('#password')
            .clear()
            .type('password');
          cy.contains('Continue')
            .click();
          cy.contains('Authorize App')
          cy.contains('Accept')
            .click();
          cy.get('h1');
    });
  });
  describe('Authenticated user (but not a participant) visiting an invite-only project', () => {
    beforeEach(() => {
      cy.intercept('/service-worker.js').as('serviceWorker'); 
      cy.restoreLocalStorage()
      //cy.wait('@serviceWorker');
    });
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `Cypress Invite-Only Project`,
          'cy-invite-only',
          ProjectAccessControlSetting.InviteOnly,
          true
        ); 
      });
    });
    afterEach(() => {
      cy.saveLocalStorage();
    });
    after(() => {
      cy.deleteProject('cy-invite-only');
    });
    it('Visits the project homepage', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/');
      cy.get('a#nav-projects').click();
      cy.wait('@serviceWorker');
    });
    it('Can sign in', () => {
      cy.contains('Cypress').click();
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('authenticated@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
    });
    it('Can share profile', () => {
      cy.get('button').contains('Share Profile').should('be.visible').as('shareProfile');
      cy.get('@shareProfile').then((btn) => {
        {btn.trigger('click')}
      });
      cy.contains('User Profile').should('be.visible');
      cy.get('[name="fullname"]').clear().type('Authenticated Jane');
      cy.get('[name="fullname"]').should("have.value", "Authenticated Jane"); 
      cy.get('[data-cy="button-send-request"]').click();
      cy.contains('Your request').should('be.visible');
    });
    it('Cannot visit project if request is outstanding', () => {
      cy.visit('/projects');
      cy.contains("Cypress").click();
      cy.wait(700);
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('authenticated@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      cy.contains('Request Awaiting Approval');
      cy.contains('Contact test_user_1@seasketch.org');
    });
  });
  describe('Unauthenticated user visiting an invite-only project', () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `Cypress Invite-Only Project`,
          'cy-invite-only',
          ProjectAccessControlSetting.InviteOnly,
          true
        ); 
      });
    });
    after(() => {
      cy.deleteProject('cy-invite-only')
    });
    it('Visits the project homepage', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/');
      cy.get('a#nav-projects').click();
    });
    it('Should be prompted to sign in or create an account', () => {
      cy.contains('Cypress').click();
      //Private project title
      cy.get('#modal-title')
      cy.contains('Create an account');
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('cypress_unverified@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
    });
    it('Should be prompted to request access', () => {
      cy.contains('Request Access').click(); 
      cy.contains('User Profile');
    });
  });
  describe('Unauthenticated returning user visiting an invite-only project', () => {
    //Need to check why approveParticipant is called twice
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
          `Cypress Invite-Only Project`,
          'cy-invite-only',
          ProjectAccessControlSetting.InviteOnly,
          true
        ).then((id) => {
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token)
          cy.saveLocalStorage()
        })
      });
    });
    after(() => {
      cy.deleteProject('cy-invite-only')
    });
    it('Visits the project homepage and project exists', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/');
      cy.get('a#nav-projects').click();
      cy.contains('Cypress Invite-Only');
      cy.contains('Sign in');
    });
    it('Is an approved participant', () => {
      cy.restoreLocalStorage()
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          cy.getToken('User 2').then(({access_token}) => {
            const projectId = parseInt(id)
            //second arg is access_token for user 2
            cy.joinProject(projectId, access_token).then((resp) => {
              const newParticipantId = resp.joinProject.query.project.unapprovedParticipants[0].id
              //second arg is user_id for user 2
              //third arg is token for user 1
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
      cy.contains('Cypress').click();
      cy.get('button').contains('Sign in');
    });
  });
  describe("Unauthenticated returning user visiting an admin-only project", () => {
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
          `Cypress Admin-Only Project`,
          'cy-admin-only',
          ProjectAccessControlSetting.AdminsOnly,
          true
        ).then((id) => {
          const attributes = {"isListed": true}
          cy.updateProject(id, access_token, attributes);
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      cy.deleteProject('cy-admin-only');
    });
    it('Visits the project homepage, project is listed, and has correct access control', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          const projectId = parseInt(id);
          cy.getProject(projectId, token).then((resp) => {
            const project = resp.query.project;
            expect (project.name).to.eq('Cypress Admin-Only Project');
            expect (project.accessControl).to.eq('ADMINS_ONLY');
            cy.setLocalStorage('getProjectResponse', JSON.stringify(resp));
          });
        });
      });
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/projects');
      cy.contains('Cypress Admin-Only');
      cy.saveLocalStorage();
    });
    it('Is a project administrator', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('getProjectResponse').then((resp) => {
        const response = JSON.parse(resp);
        expect (response.query.project.admins[0].canonicalEmail).to.eq('test_user_1@seasketch.org');
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
      cy.contains('Cypress Admin-Only');
      cy.contains('test_user_1@seasketch.org');
      cy.contains('Project Admin Dashboard');
    });
  });
  describe("Unauthenticated returning user visiting an admin-only project", () => {
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
          `Cypress Admin-Only Project`,
          'cy-admin-only',
          ProjectAccessControlSetting.AdminsOnly,
          true
        ).then((id) => {
          const attributes = {"isListed": true}
          cy.updateProject(id, access_token, attributes);
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token);
          cy.saveLocalStorage();
        })
      });
    });
    after(() => {
      cy.deleteProject('cy-admin-only');
    });
    it('Visits the project homepage, project is listed, and has correct access control', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('projectId').then((id) => {
        cy.getLocalStorage('token').then((token) => {
          const projectId = parseInt(id);
          cy.getProject(projectId, token).then((resp) => {
            const project = resp.query.project;
            expect (project.name).to.eq('Cypress Admin-Only Project');
            expect (project.accessControl).to.eq('ADMINS_ONLY');
            cy.setLocalStorage('getProjectResponse', JSON.stringify(resp));
          });
        });
      });
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/projects');
      cy.contains('Cypress Admin-Only');
      cy.saveLocalStorage();
    });
    it('Is not a project administrator', () => {
      cy.restoreLocalStorage();
      cy.getLocalStorage('getProjectResponse').then((resp) => {
        const response = JSON.parse(resp);
        expect (response.query.project.admins[0].canonicalEmail).to.not.include('test_user_2@seasketch.org');
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
      cy.contains('Admins Only');
      cy.contains('Cypress Admin-Only');
      cy.contains('test_user_1@seasketch.org');
    });
  });
});

//##############################
describe('User onboarding via email invites', () => {
  projectOptions.forEach((projectOption) => {
    if (projectDetails[projectOption]) {
      describe(`A new SeaSketch user receiving an invitation to a(n) ${projectOption} project`, () => {
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
          const userSlug = generateSlug()
          //const accessControl = projectDetails[project].accessControl
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
          Cypress.on('uncaught:exception', (err, runnable) => {
            if (err.message.includes('ServiceWorker')) {
              return false
            }
          });
          getAuth0ApiToken().then((resp) => {
            //cy.log(resp)
            const token = resp.access_token;
            deleteAllAuth0CypressUsers(token);
          })
          cy.deleteUser(newUser)
          cy.deleteProject(`${projectDetails[projectOption].slug}`);

        });
        it('Creates a project invite with correct project name and sign-up link', () => {
          Cypress.on('uncaught:exception', (err, runnable) => {
            if (err.message.includes('ServiceWorker')) {
              return false
            }
          });
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
              //getUsers()
              cy.createProjectInvites(projectId, options, token).then((resp) => {
                const respData = resp.createProjectInvites
                //check that the project has the correct accessControl and is public
                expect (respData.query.project.accessControl).to.equal(`${projectDetails[projectOption].accessControl}`);
                if (projectOption === "inviteOnly" || projectOption === "public") {
                  expect (respData.query.project.isListed).to.equal(true);
                } else {
                  cy.updateProject(projectId, token, ["isListed", "true"]).then((data) => {
                    expect(data.updateProject.project.isListed).to.equal(true);
                  });
                }
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
          cy.contains(`${projectDetails[projectOption].name}`);
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
          cy.contains('Join Project');
          cy.contains('Skip for now');
        });
      });
    };
  });

  projectOptions.forEach((project) => {
    describe(`An unauthenticated SeaSketch user receiving an invitation to a listed, ${project} project`, () => {
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
        const userSlug = generateSlug()
        //const accessControl = projectDetails[project].accessControl
        //newUser = `cypress_user_${userSlug}@seasketch.org`
        cy.getToken("User 1").then(({ access_token }) => {
          cy.wrap(access_token).as("token");
          cy.setLocalStorage("token", access_token);

          cy.createProject(
            `${projectDetails[project].name}`,
            `${projectDetails[project].slug}`,
              projectDetails[project].accessControl,
            true
          ).then((id) => {
            cy.setLocalStorage('projectId', id as any);
            cy.setLocalStorage('token', access_token);
            cy.saveLocalStorage();
          })
        });
      });
      after(() => {
        Cypress.on('uncaught:exception', (err, runnable) => {
          if (err.message.includes('ServiceWorker')) {
            return false;
          }
        });
        cy.deleteProject(`${projectDetails[project].slug}`);
      });
      it('Creates a project invite with correct project name and sign-up link', () => {
        Cypress.on('uncaught:exception', (err, runnable) => {
          if (err.message.includes('ServiceWorker')) {
            return false;
          }
        });
        cy.restoreLocalStorage();
        const options = ['test_user_2@seasketch.org'];
        cy.getLocalStorage('projectId').then((id) => {
          const projectId = parseInt(id);
          cy.getLocalStorage('token').then((token) => {
            //getUsers()
            cy.createProjectInvites(projectId, options, token).then((resp) => {
              const respData = resp.createProjectInvites
              //check that the project has the correct accessControl and is public
              expect (respData.query.project.accessControl).to.equal(`${projectDetails[project].accessControl}`);
              if (project === "inviteOnly" || project === "public") {
                expect (respData.query.project.isListed).to.equal(true);
              } else {
                cy.updateProject(projectId, token, ["isListed", "true"]).then((data) => {
                  expect(data.updateProject.project.isListed).to.equal(true)
                });
              }
              const projectInvites = resp.createProjectInvites.projectInvites;
              console.log(projectInvites)
              expect (projectInvites.length).to.eq(options.length);
              expect (projectInvites[0].email).to.eq(options[0]);
              expect (projectInvites[0].projectId).to.eq(projectId);
              //wait for file write to finish 
              cy.wait(1000)
              cy.readFile(__dirname + "./../../../../api/invite-emails-cypress/email").then((txt) => {
                console.log(txt)
                const textAry = txt.split("\n");
                const inviteUrl = textAry.find(element => element.includes('https'));
                expect (txt).to.include(`Destination: test_user_2@seasketch.org`);
                expect (txt).to.include(projectDetails[project].name);
                expect (txt).to.include('token');
                let urlAry = inviteUrl.split('/');
                urlAry.splice(0,3, Cypress.config().baseUrl);
                cy.visit(urlAry.join('/'));
                cy.wait('@verifyProjectInvite').its('response').then((resp) => {
                  console.log(resp)
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
        cy.contains(`${projectDetails[project].name}`);
        cy.get('[data-cy="button-sign-in"]')
          .should('be.visible');
        cy.get('[data-cy="button-create-an-account"]')
          .should('be.visible');
      });
      it('Prompts user to join project after signing in', () => {
        cy.get('#username')
          .should('have.value', 'test_user_2@seasketch.org');
        cy.get('#password').type('password');
        cy.contains('Continue').click();
        //cy.contains('Accept').click();
        cy.wait('@confirmProjectInvite');
        cy.contains(`${projectDetails[project].name}`);
        cy.contains('Skip for now');
        cy.get('[name="fullname"]')
          .clear()
          .type('Test User 2');
        cy.contains('Join Project').click();
        cy.wait('@getProjectRegion')
        cy.contains(projectDetails[project].name)
      });
    });   
  });

  //##################
  projectOptions.forEach((projectOption) => {
    //public projects cannot be unlisted
    if (projectOption !== "public") {
      describe(`An unauthenticated SeaSketch user receiving an invitation to an unlisted, ${projectOption} project`, () => {
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
          const userSlug = generateSlug()
          //const accessControl = projectDetails[project].accessControl
          //newUser = `cypress_user_${userSlug}@seasketch.org`
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
          Cypress.on('uncaught:exception', (err, runnable) => {
            if (err.message.includes('ServiceWorker')) {
              return false;
            }
          });
          cy.deleteProject(`${projectDetails[projectOption].slug}`);
        });
        it('Creates a project invite with correct project name and sign-up link', () => {
          Cypress.on('uncaught:exception', (err, runnable) => {
            if (err.message.includes('ServiceWorker')) {
              return false;
            }
          });
          cy.restoreLocalStorage();
          //const options = ['test_user_2@seasketch.org'];
          let options
          if (projectOption === "admins-only") {
            //sets sendEmailNow and makeAdmin to true for adminsOnly projects
            options = ['test_user_2@seasketch.org', true, true];
          } else {
            //sets sendEmailNow to true, makeAdmin to false
            options = ['test_user_2@seasketch.org', true, false];
          }
          
          cy.getLocalStorage('projectId').then((id) => {
            const projectId = parseInt(id);
            cy.getLocalStorage('token').then((token) => {
              //getUsers()
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
                    if (projectOption === 'admins-only') {
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
          cy.get('[data-cy="button-sign-in"]')
            .should('be.visible');
          cy.get('[data-cy="button-create-an-account"]')
            .should('be.visible');
        });
        it('Prompts user to join project after signing in', () => {
          cy.get('#username')
            .should('have.value', 'test_user_2@seasketch.org');
          cy.get('#password').type('password');
          cy.contains('Continue').click();
          //cy.contains('Accept').click();
          cy.wait('@confirmProjectInvite');
          cy.contains(`${projectDetails[projectOption].name}`);
          cy.contains('Skip for now');
          cy.get('[name="fullname"]')
            .clear()
            .type('Test User 2');
          cy.contains('Join Project').click();
          cy.wait('@getProjectRegion')
          cy.contains(projectDetails[projectOption].name)
        });
      });
    };
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
        if ((req.body.operationName) && (req.body.operationName === "ConfirmProjectInvite")) {
          req.alias = "confirmProjectInvite"
        };
        if (((req.body.operationName) && (req.body.operationName === "ProjectRegion"))) {
          req.alias = "getProjectRegion"
        };
      });
    });
    before(() => {
      const userSlug = generateSlug()
      //const accessControl = projectDetails[project].accessControl
      //newUser = `cypress_user_${userSlug}@seasketch.org`
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
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false;
        }
      });
      //cy.deleteProject(`${projectDetails['invite-only'].slug}`);
    });
    it('Creates a project invite with correct project name and sign-up link', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false;
        }
      });
      cy.restoreLocalStorage();
      //const options = ['test_user_2@seasketch.org'];
      let options
      let date = new Date()
      console.log(date)
        options = ['test_user_2@seasketch.org', true, false];
      //getAuthOUserByEmail('cypress_user_n0elo@seasketch.org')
      //getAuth0ApiToken()
      
      cy.getLocalStorage('projectId').then((id) => {
        const projectId = parseInt(id);
        cy.getLocalStorage('token').then((token) => {
          //getUsers()
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
                expect(resp.body.data.verifyProjectInvite.claims.admin).to.equal(false);
                }
              )
            });
          });
        });
      });
    });
  }); 
  describe.only('It deletes users', () => {
    before (() => {
      cy.intercept("/oauth/token").as('getAuth0Token');
    })
    it ('Deletes users', () => {
      getAuth0ApiToken().then((resp) => {
        cy.log(JSON.stringify(resp))
        console.log(resp)
      })
    
      //deleteAuth0CypressUser()
      //deleteAllAuth0CypressUsers()
      //const results = getAuthOUserByEmail('cypress_user_n0elo@seasketch.org')
      //console.log(results)
    })
  })
});
 
 
////cy.restoreLocalStorage()
  //    //cy.getLocalStorage('projectId').then((id) => {
      //  cy.getLocalStorage('token').then((token) => {
      //    cy.getToken('User 2').then(({access_token}) => {
      //      const projectId = parseInt(id)
      //      //Second arg is access_token for user 2
      //      //User 2 cannot join project because it is adminsOnly, but I am using this mutation
      //      //to get userId of User 2
      //      cy.joinProject(projectId, access_token).then((resp) => {
      //        console.log(resp)
      //        const newAdminId = resp.joinProject.query.project.unapprovedParticipants[0].id
      //        console.log(newAdminId)
      //        cy.toggleAdminAccess(7, projectId, token).then((resp) => {
      //          console.log(resp)
      //        })
      //        ////second arg is user_id for user 2
      //        ////third arg is token for user 1
      //        //cy.approveParticipant(projectId, newParticipantId, token);
      //        //cy.wait('@approveParticipant').its('response').then((resp) => {
      //        //  const project = resp.body.data.approveParticipant.query.project
      //        //  let participants = []
      //        //  project.participants.forEach((t) => {
      //        //    participants.push(t.canonicalEmail);
      //        //  });
      //        //  expect (participants).to.include('test_user_2@seasketch.org');
      //        //});
      //      });
      //    });
      //  });
      //}); 
