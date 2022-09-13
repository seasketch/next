/* eslint-disable cypress/no-unnecessary-waiting */
import { ParticipantSortBy, ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import {deleteUser} from "../../support/deleteUser.js"
import { access } from "fs";

const generateSlug = () => { 
  const result = Math.random().toString(36).substring(2,7);
  return result
};

const slug = generateSlug()

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
  describe.only('Unauthenticated returning user visiting an invite-only project', () => {
    //Need to assert on sessionHasPrivilegedAccess
    //Make userId dynamic
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
        console.log(access_token)
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
        console.log(id)
        cy.getLocalStorage('token').then((token) => {
          cy.getToken('User 2').then(({access_token}) => {
            const projectId = parseInt(id)
            console.log(projectId)
            cy.joinProject(projectId, access_token).then((resp) => {
              //second arg is user_id for test_user_2
              const newParticipantId = resp.joinProject.query.project.unapprovedParticipants[0].id
              cy.approveParticipant(projectId, newParticipantId, token).then((resp) => {
               
                console.log(resp)
              });
              cy.wait('@approveParticipant').its('response').then((resp) => {
                console.log(resp)
                const project = resp.body.data.approveParticipant.query.project
                let participants = []
                project.participants.forEach((t) => {
                  participants.push(t.canonicalEmail);
                });
                cy.log(`${participants}`)
                expect (participants).to.include('test_user_2@seasketch.org');
              });
            })//;
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
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        console.log(access_token)
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `Cypress Admin-Only Project`,
          'cy-admin-only',
          ProjectAccessControlSetting.AdminsOnly,
          true
        ).then((id) => {
          cy.setLocalStorage('projectId', id as any);
          cy.setLocalStorage('token', access_token)
          cy.saveLocalStorage()
        })
      });
    });
    after(() => {
      cy.deleteProject('cy-admin-only');
    });
    it('Visits the project homepage', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/projects');
    });
  });
});
