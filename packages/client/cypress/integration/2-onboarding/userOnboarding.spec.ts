/* eslint-disable cypress/no-unnecessary-waiting */
import { ParticipantSortBy, ProjectAccessControlSetting} from "../../../src/generated/graphql";
import "cypress-localstorage-commands";
import { deleteUser } from "../../support/deleteUser.js"
import { getAuth0ApiToken, getAuth0CypressUserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug } from '../../support/utils.js'
import { mkdirSync } from "fs";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fs = require('fs');

const projectDetails = 
  {"inviteOnly": {
    "name": "Cypress Invite-Only Project",
    "slug": "cy-invite-only", 
    "accessControl": ProjectAccessControlSetting.InviteOnly
    },
    "adminsOnly": {
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

//When this test runs, a user can sign in and navigate to project, 
//but when trying to share profile and request access, a TypeError occurs
describe ("User onboarding via independent browsing", () => {
  describe('Authenticated user (but not a participant) visiting an invite-only project', () => {
    beforeEach(() => {
      cy.intercept('/service-worker.js').as('serviceWorker'); 
      cy.restoreLocalStorage()
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
      cy.get('#username').type('test_user_2@seasketch.org');
      cy.get('#password').type('password');
      cy.contains('Continue').click();
    });
    it('Can share profile', () => {
      cy.get('button').contains('Share Profile').should('be.visible').as('shareProfile');
      //cy.percySnapshot();
      cy.get('@shareProfile').then((btn) => {
        {btn.trigger('click')}
      });
      cy.contains('User Profile').should('be.visible');
      //cy.get('[name="fullname"]').clear().type('Authenticated Jane');
      //cy.get('[name="fullname"]').should("have.value", "Authenticated Jane"); 
      //cy.get('[data-cy="button-send-request"]').click();
      //cy.contains('Your request').should('be.visible');
    });
    //it('Cannot visit project if request is outstanding', () => {
    //  cy.visit('/projects');
    //  cy.contains("Cypress").click();
    //  cy.wait(700);
    //  cy.get('button').contains('Sign in').click();
    //  cy.get('#username').type('test_user_2@seasketch.org');
    //  cy.get('#password').type('password');
    //  cy.contains('Continue').click();
    //  cy.contains('Request Awaiting Approval');
    //  cy.contains('Contact test_user_1@seasketch.org');
    //});
  });
});