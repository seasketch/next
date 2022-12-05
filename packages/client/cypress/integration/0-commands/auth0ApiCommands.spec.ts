/* eslint-disable cypress/no-unnecessary-waiting */

import { getAuth0ApiToken, getAuth0UserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'
const axios = require("axios").default;
describe ("Calls to Auth0 management api", () => {
  before(() => {
    cy.intercept('https://seasketch.auth0.com/api/v2/*').as('auth0ApiCall')
  })
  it('Can delete users', () => {
    getAuth0ApiToken().then((resp) => {
      cy.wait('@auth0ApiCall')
      const token = resp.access_token
      getAuth0UserByEmail('test_user_1@seasketch.org', token).then((resp) => {
        expect(resp[0].email).to.eq('test_user_1@seasketch.org')
      })
      deleteAllAuth0CypressUsers(token)
      cy.wait('@auth0ApiCall')
      cy.wait(1000)
      const getAllCypressUsers = {
        method: 'GET',
        url: 'https://seasketch.auth0.com/api/v2/users',
        params: {q: 'email:cypress*', search_engine: 'v3'},
        headers: {authorization: `Bearer ${token}`, 
        }
      };
      axios.request(getAllCypressUsers).then(resp => {
        const users = resp.data
        expect(users.length).to.eq(0)
      });
    });
  })
})