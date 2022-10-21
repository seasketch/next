const axios = require("axios").default;
/// <reference types="cypress" />


//SLUG ACTIONS


export const generateSlug = () => { 
  const result = Math.random().toString(36).substring(2,7);
  return result
};

//USER ACTIONS

export async function getAuth0ApiToken () {
  console.log('Get Auth0 management API token')
  console.log(Cypress.env('auth0_management_api_client_id'))
  var options = {
    method: 'POST',
    url: 'https://seasketch.auth0.com/oauth/token',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    data: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: Cypress.env('auth0_management_api_client_id'),
      client_secret: Cypress.env('auth0_management_api_client_secret'),
      audience: 'https://seasketch.auth0.com/api/v2/'
    })
  };
  const results = await axios.request(options).then(function (response) {
    console.log(response.data);
    return response.data
  }).catch(function (error) {
    console.error(error);
    return error
  });
  return results
};

export function getAuth0CypressUserByEmail (email, token) {
  const getUserByEmailOptions = {
    method: 'GET',
    url: `https://seasketch.auth0.com/api/v2/users-by-email?email=${email}`,
    headers: {authorization: `Bearer ${token}`, 
    }
  };
  const results = axios.request(getUserByEmailOptions).then(resp => {
    return resp.data
  });
  return results
}

export function deleteAllAuth0CypressUsers (token) {
  const getAllCypressUsers = {
    method: 'GET',
    url: 'https://seasketch.auth0.com/api/v2/users',
    params: {q: 'email:cypress*', search_engine: 'v3'},
    headers: {authorization: `Bearer ${token}`, 
    }
  };
  axios.request(getAllCypressUsers).then(resp => {
    const users = resp.data
    resp.data.forEach((t) => {
      const userId = t.user_id
      const deleteCypressUserOptions = {
        method: 'DELETE',
        url: `https://seasketch.auth0.com/api/v2/users/${userId}`,
        headers: {authorization: `Bearer ${token}`, 
        }
      };
      axios.request(deleteCypressUserOptions).then(function (response) {
        console.log(`Deleting ${users.length} user${users.length !== 1 ? "s" : ""} from Auth0`);
      }).catch(function (error) {
        console.error(error);
      });
    });
  });
};

export async function deleteAuth0CypressUser (userId, token) {
  console.log("Deleting user from Auth0")
  const deleteCypressUserOptions = {
    method: 'DELETE',
    url: `https://seasketch.auth0.com/api/v2/users/${userId}`,
    headers: {authorization: `Bearer ${token}`, 
    }
  };
  axios.request(deleteCypressUserOptions).then(function (response) {
    console.log(response.data);
    return response.data
  }).catch(function (error) {
    console.error(error);
  });
}; 
