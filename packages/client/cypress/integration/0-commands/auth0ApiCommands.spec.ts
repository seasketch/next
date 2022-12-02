
import { getAuth0ApiToken, getAuth0UserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'
const axios = require("axios").default;
describe ("Calls to Auth0 management api", () => {
  it('Retrieves correct token', () => {
    getAuth0ApiToken().then((resp) => {
      console.log(resp)
      if (resp.access_token !== null) {
        cy.log('Access token present')
      } else {
        cy.log('Access token is null')
      }
      expect(resp).to.haveOwnProperty('access_token');
    })
  })
  it('Can query API for user by email', () => {
    getAuth0ApiToken().then((resp) => {
      const token = resp.access_token
      getAuth0UserByEmail('test_user_1@seasketch.org', token).then((resp) => {
        expect(resp[0].email).to.eq('test_user_1@seasketch.org')
      })
    });
  });
  it ('Can delete users', () => {
    getAuth0ApiToken().then((resp) => {
      const token = resp.access_token
      //Can only delete 50 users at a time
      deleteAllAuth0CypressUsers(token)
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
    })
  })
})