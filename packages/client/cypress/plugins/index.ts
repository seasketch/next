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
