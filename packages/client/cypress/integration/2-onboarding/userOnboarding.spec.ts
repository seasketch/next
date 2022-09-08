/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import {deleteUser} from "../../support/deleteUser.js"

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
          //  .click()
          cy.contains('Accept')
            .click();
          cy.get('h1').then((header) => {
            console.log(header)
          }) 
          //cy.contains('Join this Project')
      //  }else {
      //    cy.contains('Sign Out').click()
      //  }
      //  console.log(a.text())
      //})
      
      
      //cy.contains("Sign up")
      //  .should('be.visible')
      //  .click()
      //cy.get('#email')
      //  .clear()
      //  .type(`cypress_${slug}@seasketch.org`);
      //cy.get('#password')
      //  .clear()
      //  .type(`${users["Anon User"].password}`);
      //cy.contains('Continue')
      //  .click();
      //cy.contains('Authorize App')
      ////  .click()
      //cy.contains('Accept')
      //  .click(); 
      ////cy.contains("Join This Project")
      ////////
      //////////deleteUser(users["Anon User"].email)
      //////////console.log(users["Anon User"].password)
    })//////
    
  })  
  describe.only('Authenticated user (but not a participant) visiting an invite-only project', () => {
    beforeEach(() => {
      cy.intercept('/service-worker.js').as('serviceWorker'); 
      //cy.wait('@serviceWorker');
    });
    before (() => {
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
      //cy.login('Authenticated User')
    });
    after(() => {
      cy.deleteProject('cy-invite-only')
    });
    it ('Visits the project homepage', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        // we expect a 3rd party library error with message 'list not defined'
        // and don't want to fail the test so we return false
        if (err.message.includes('ServiceWorker')) {
          return false
        }
        // we still want to ensure there are no other unexpected
        // errors, so we let them fail the test
      });
      cy.visit('/');
      cy.get('a#nav-projects').click();
      cy.wait('@serviceWorker');
    });
    it ('Can sign in', () => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        // we expect a 3rd party library error with message 'list not defined'
        // and don't want to fail the test so we return false
        if (err.message.includes('ServiceWorker')) {
          return false
        }
        // we still want to ensure there are no other unexpected
        // errors, so we let them fail the test
      });
      cy.contains('Cypress').click();
      cy.get('button').contains('Sign in').click();
      cy.get('#username').type('authenticated@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
      //cy.get('[title="Sign In"]').click();
      //cy.get('#username').type('authenticated@seasketch.org');
      //cy.get('#password').type('password');
      //cy.contains('Continue').click();
    });
    it ('Can share profile', () => {
      cy.get('button').contains('Share Profile').should('be.visible').as('shareProfile');
      cy.get('@shareProfile').then((btn) => {
        {btn.trigger('click')}
      });
      cy.contains('User Profile').should('be.visible');
      cy.get('[name="fullname"]').clear().type('Authenticated Jane');
      cy.get('[name="fullname"]').should("have.value", "Authenticated Jane"); 
      cy.get('[data-cy="button-send-request"]').click();
      cy.contains('Your request').should('be.visible');
      //cy.login('Authenticated User')
    });
    it ('Cannot visit project if request is outstanding', () => {
      cy.visit('/projects');
      cy.contains("Cypress").click();
      //cy.contains('Request').should('not.be.visible')
      cy.get('h3').then((btn) => {
        console.log(btn.text())
        cy.wait(500)
        //if(btn.text().includes('Sign in')) {
          cy.get('button').contains('Sign in').click();
          cy.get('#username').type('authenticated@seasketch.org');
          cy.get('#password').type('password');
          cy.contains('Continue').click();
          cy.contains('Request Awaiting Approval')
        //} else {
        //  cy.contains('Request awaiting approval')
        //}
        //console.log(btn.text())
      })
      
    });
  });
});
