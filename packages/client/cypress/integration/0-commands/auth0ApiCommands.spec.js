import { getAuth0ApiToken, getAuth0CypressUserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'


describe ('Auth0 management API calles', () => {
  it ('Receives correct token', () => {
    getAuth0ApiToken().then((resp) => {
      expect (resp).to.haveOwnProperty('access_token')
    })
  })
})