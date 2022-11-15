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

let newUser; 

//This test highlights issue #447. When a new user tries to join a public project, after creating an account
//and authorizing SeaSketch access, the user is signed in and redirected to the project app page. The appropriate
//redirect should be to a join project form.
describe ("User onboarding via independent browsing", () => {
  describe.only ("New user visiting a public project", () => {
    beforeEach(() => {
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.intercept('/service-worker.js').as('serviceWorker')
      cy.intercept("http://localhost:3857/graphql", (req) => {
         if ((req.body.operationName) && (req.body.operationName === "UserIsSuperuser")) {
           req.alias = "userIsSuperuser"
        };
      });
    });
    before (() => {
      const userSlug = generateSlug();
      newUser = `cypress_user_${userSlug}@seasketch.org`
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.setLocalStorage("token", access_token);
        cy.createProject(
          `${projectDetails.public.name}`,
          `${projectDetails.public.slug}`,
          ProjectAccessControlSetting.Public,
          true
        );
      });
    });
    after(() => {
      cy.deleteProject('cy-public');
      //getAuth0ApiToken().then((resp) => {
      //  const token = resp.access_token;
      //  deleteAllAuth0CypressUsers(token);
      //});
      cy.deleteUser(newUser);
    });
    it('Visits the project homepage', () =>{
      Cypress.on('uncaught:exception', (err, runnable) => {
        if (err.message.includes('ServiceWorker')) {
          return false
        }
      });
      cy.visit('/');
      cy.get('a#nav-projects')
        .click();
      cy.contains('Cypress Public Project')
        .click();
    });
    it ('Should be prompted to share profile information', () => {
      cy.get('button').then((btn) => {
        if (btn.text().includes('Sign In')) {
          cy.contains('Sign In')
            .click();
        }
      });
      cy.get('a').then((a) => {
        if (a.text().includes('Sign up')) {
          cy.contains('Sign up')
            .click();
          cy.get('#email')
            .clear()
            .type(`${newUser}`);
          cy.get('#password')
            .clear()
            .type('password');
          cy.contains('Continue')
            .click();
          cy.contains('Authorize App')
          cy.contains('Accept')
            .click();
          cy.get('h1');
        }
      });
      cy.contains('Cypress Public Project');
      cy.contains('Join this Project');
    });
  });
});
