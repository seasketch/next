/* eslint-disable cypress/no-unnecessary-waiting */
const axios = require("axios").default;
///<reference types="cypress" />

//SLUG ACTIONS

export const generateSlug = () => {
  const result = Math.random().toString(36).substring(2, 7);
  return result;
};

//SURVEY ACTIONS

export const waitOnMapbox = (count) => {
  for (; count; count--) {
    cy.wait("@mapboxApiCall").then((intercepts) => {
      expect(intercepts.response.statusCode).to.be.oneOf([200, 204]);
    });
  }
};

export const checkForNavAndLang = () => {
  //navigation and language buttons
  cy.get('[title="Previous Question"]').should("be.visible").and("exist");
  cy.get('[title="Next Question"]').should("be.visible").and("exist");
  cy.get("button.px-3").should("be.visible");
};

export const drawPolygon = () => {
  cy.contains("span", "Click on the map to start a polygon", {
    timeout: 30000,
  });
  cy.window()
    .its("mapContext")
    .then((mapContext) => {
      let map = mapContext.map;
      cy.wait(map.loaded() ? 1000 : 8000);
      cy.window()
        .its("mapContext")
        .then((mapContext) => {
          let map = mapContext.map;
          cy.wait(map.loaded() ? 1000 : 8000);
          cy.get('[role="progressbar"]').should("not.exist");
          cy.get(".mapboxgl-canvas")
            .each((t) => {
              const canvases = [];
              canvases.push(t);
              return canvases;
            })
            .then((ary) => {
              const el = ary[0];
              return el;
            })
            .as("el");
          cy.get("@el")
            .click(100, 500)
            .click(100, 600)
            .click(200, 600)
            .click(200, 500)
            .click(100, 500);
        });
    });
};

export const drawInvalidPolygon = () => {
  cy.get(".mapboxgl-canvas")
    .each((t) => {
      const canvases = [];
      canvases.push(t);
      return canvases;
    })
    .then((ary) => {
      const el = ary[0];
      return el;
    })
    .as("el");
  cy.get("@el")
    .click(100, 200)
    .click(100, 100)
    .click(200, 200)
    .click(50, 200)
    .click(100, 200);
};

export const drawSecondPolygon = () => {
  cy.get(".mapboxgl-canvas")
    .each((t) => {
      const canvases = [];
      canvases.push(t);
      return canvases;
    })
    .then((ary) => {
      const el = ary[0];
      return el;
    })
    .as("el");
  cy.get("@el")
    .click(200, 200)
    .click(150, 200)
    .click(150, 150)
    .click(200, 150)
    .click(200, 200);
};

//AUTH0 MANAGEMENT API ACTIONS

export function getAuth0ApiToken() {
  var options = {
    method: "POST",
    url: "https://seasketch.auth0.com/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: Cypress.env("auth0_management_api_client_id"),
      client_secret: Cypress.env("auth0_management_api_client_secret"),
      audience: "https://seasketch.auth0.com/api/v2/",
    }),
  };
  const results = axios
    .request(options)
    .then(function (response) {
      return response.data;
    })
    .catch(function (error) {
      console.error(error);
      return error;
    });
  return results;
}

export function getAuth0UserByEmail(email, token) {
  const getUserByEmailOptions = {
    method: "GET",
    url: `https://seasketch.auth0.com/api/v2/users-by-email?email=${email}`,
    headers: { authorization: `Bearer ${token}` },
  };
  const results = axios.request(getUserByEmailOptions).then((resp) => {
    return resp.data;
  });
  return results;
}

export async function updateAuth0User(id, token) {
  //https://seasketch.auth0.com/api/v2/users/auth0%7C638e2ca091ac5f1a5d437289
  const updateUserOptions = {
    method: "PATCH",
    url: `https://seasketch.auth0.com/api/v2/users/${id}`,
    headers: { authorization: `Bearer ${token}` },
    data: { email_verified: true },
  };
  const results = await axios.request(updateUserOptions).then((resp) => {
    return resp.data;
  });
  return results;
}

export function deleteAllAuth0CypressUsers(token) {
  const getAllCypressUsers = {
    method: "GET",
    url: "https://seasketch.auth0.com/api/v2/users",
    params: { q: "email:cypress*", search_engine: "v3" },
    headers: { authorization: `Bearer ${token}` },
  };
  axios.request(getAllCypressUsers).then((resp) => {
    const users = resp.data;
    resp.data.forEach((t) => {
      const userId = t.user_id;
      const deleteCypressUserOptions = {
        method: "DELETE",
        url: `https://seasketch.auth0.com/api/v2/users/${userId}`,
        headers: { authorization: `Bearer ${token}` },
      };
      axios
        .request(deleteCypressUserOptions)
        .then(function (response) {
          console.log(
            `Deleting ${users.length} user${
              users.length !== 1 ? "s" : ""
            } from Auth0`
          );
        })
        .catch(function (error) {
          console.error(error);
        });
    });
  });
}

export function deleteAuth0CypressUser(userId, token) {
  console.log("Deleting user from Auth0");
  const deleteCypressUserOptions = {
    method: "DELETE",
    url: `https://seasketch.auth0.com/api/v2/users/${userId}`,
    headers: { authorization: `Bearer ${token}` },
  };
  axios
    .request(deleteCypressUserOptions)
    .then(function (response) {
      return response.data;
    })
    .catch(function (error) {
      console.error(error);
    });
}

//ERROR ACTIONS

export const bypassUncaughtException = (keyword) => {
  Cypress.on("uncaught:exception", (err, runnable) => {
    if (err.message.includes(`${keyword}`)) {
      return false;
    }
  });
};
