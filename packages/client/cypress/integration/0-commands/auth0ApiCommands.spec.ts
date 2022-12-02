
import { getAuth0ApiToken, getAuth0CypressUserByEmail, deleteAuth0CypressUser, deleteAllAuth0CypressUsers, generateSlug, bypassUncaughtException } from '../../support/utils.js'

describe ("Calls to Auth0 management api", () => {
  it('Retrieves correct token', () => {
    getAuth0ApiToken().then((resp) => {
      expect(resp).to.haveOwnProperty('access_token')
    })
  })
})