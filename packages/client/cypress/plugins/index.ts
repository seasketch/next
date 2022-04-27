const dotenv = require("dotenv");

dotenv.config();

export default function BasePlugin(on, config) {
  config.env.auth0_domain = process.env.REACT_APP_AUTH0_DOMAIN;
  config.env.auth0_audience = process.env.REACT_APP_AUTH0_AUDIENCE;
  config.env.auth0_scope = "openid profile email permissions";
  config.env.auth0_client_id = process.env.REACT_APP_AUTH0_CLIENT_ID;
  config.env.auth0_client_secret = process.env.CYPRESS_AUTH0_CLIENT_SECRET;
  config.env.graphql_endpoint = process.env.REACT_APP_GRAPHQL_ENDPOINT;
  return config;
}

module.exports = (on, config) => {
  /** the rest of your plugins... **/
  require('cypress-log-to-output').install(on)
  // or, if there is already a before:browser:launch handler, use .browserLaunchHandler inside of it
  // @see https://github.com/flotwig/cypress-log-to-output/issues/5
}
