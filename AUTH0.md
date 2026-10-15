# Auth0 tenant setup

SeaSketch uses Auth0 for user account authentication. The committed `.env` templates already point at the SeaSketch development tenant, `seasketch-dev.us.auth0.com`, with audience `https://api.nonprod.seasketch.org`. Copy them (`ENV.md`). Login from `http://localhost:3000` works with those public values. `AUTH0_CLIENT_SECRET` is the one Auth0 value a teammate has to give you, and the API starts without it.

An install that is not this one creates its own tenant. Do not point it at `seasketch.auth0.com` or `https://api.seasketch.org`. Setup refuses those. Follow the steps below and replace the template values.

Automated tests do not use Auth0. `E2E_TEST_MODE` mints its own tokens. You need this setup for a person to log in from the running client.

## What you create

One tenant, on Auth0's Free plan:

| Piece                          | What it is                                                                             | Where the value goes                         |
| ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Tenant domain                  | Host Auth0 assigns, such as `my-seasketch.us.auth0.com`                                | `AUTH0_DOMAIN` and `REACT_APP_AUTH0_DOMAIN`  |
| API                            | The access-token audience. An identifier you choose. It does not have to be a live URL | `JWT_AUD` and `REACT_APP_AUTH0_AUDIENCE`     |
| Single-page application        | The public client the browser uses                                                     | `REACT_APP_AUTH0_CLIENT_ID`                  |
| Machine-to-machine application | The API server's client for the Auth0 Management API                                   | `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`  |
| Role `seasketch_superuser`     | Named staff. Everyone else is a normal user                                            | Assigned in the dashboard after they sign up |
| Post-login Action              | Copies email and the superuser flag into the tokens                                    | Bound to the Login flow                      |

The claim names stay `https://seasketch.org/canonical_email`, `https://seasketch.org/email_verified`, and `https://seasketch.org/superuser` on every install. That namespace is an identifier in the code, not your site's hostname. Your tenant domain and audience are what change.

`packages/api/.env.template` currently fills the issuer, JWKS URL, and audience with the seasketch.org production tenant. Replace those. A token from your tenant is useless there, and you cannot manage its users.

Auth0's Free plan covers this list. Leave custom domains, enterprise connections, and SMS multi-factor authentication off.

## 1. Create the tenant

Sign up at [Auth0](https://auth0.com) and create a tenant. Choose a region close to you. Copy the domain from the dashboard exactly, including the region label when Auth0 includes one (`something.us.auth0.com`, not `something.auth0.com`).

From that domain:

- `JWT_ISS` is `https://<domain>/`, with the trailing slash.
- `JWKS_URI` is `https://<domain>/.well-known/jwks.json`.

## 2. Create the API

Applications → APIs → Create API.

- **Identifier.** Yours. For a laptop, `https://api.localhost` is fine. Use the same string for `JWT_AUD` and `REACT_APP_AUTH0_AUDIENCE`.
- **Signing algorithm.** RS256. The API rejects anything else.
- **Allow Offline Access.** On. The client asks for a refresh token.
- **Allow Skipping User Consent.** On, for this first-party application.

Then open the API's settings and turn on:

- **Enable RBAC**
- **Add Permissions in the Access Token**

Leave JSON Web Encryption off. RBAC is what puts the superuser role on the login event. With it off, the Action below never sees roles, and superuser stays false.

## 3. Create the single-page application

Applications → Create Application → Single Page Application.

| Setting                | Local client                         |
| ---------------------- | ------------------------------------ |
| Allowed Callback URLs  | `http://localhost:3000/authenticate` |
| Allowed Logout URLs    | `http://localhost:3000/`             |
| Allowed Web Origins    | `http://localhost:3000`              |
| Allowed Origins (CORS) | `http://localhost:3000`              |

The client sends people to `{origin}/authenticate` and logs them out to `{origin}/`. A deployment on another host uses that host instead of `localhost:3000`. Keep the path `/authenticate` and the trailing slash on the logout URL.

This application is public. It has no secret. Its client id is `REACT_APP_AUTH0_CLIENT_ID`.

Under the application's refresh-token settings, use rotating refresh tokens. Auth0's SPA preset already does. The client scope is `openid profile email offline_access`.

## 4. Create the management application

Applications → Create Application → Machine to Machine. When Auth0 asks which API it calls, choose **Auth0 Management API**.

Grant only these scopes:

- `read:users`
- `update:users`

The API uses them to look up a person's email and to mark an address verified. Broader management scopes are not required.

This application's client id is `AUTH0_CLIENT_ID`. Its client secret is `AUTH0_CLIENT_SECRET`. Keep the secret in the API `.env` only. Do not commit it, and do not put it in the client `.env`.

The id from step 3 and the id from this step are different applications.

## 5. Enable a database connection

Authentication → Database → Username-Password-Authentication. Enable it for the single-page application from step 3.

Google is optional. Auth0's built-in Google development keys work for `localhost`. A public hostname needs a Google OAuth client of your own, attached to the Google connection. Skip that for a local install.

## 6. Create the superuser role

User Management → Roles → Create Role.

- **Name.** `seasketch_superuser`
- **Description.** Whatever you like. The code checks the name.

Assign it only after the person has signed up once, so their user exists in this tenant. User ids do not carry over from any other tenant. After you assign the role, they sign out and sign in again. The next token then has `https://seasketch.org/superuser` set to true.

Superuser is this role. It is not a field on the user's `app_metadata`.

## 7. Add the login Action

Actions → Library → Create Action → Build from scratch.

- **Name.** `add-claims`
- **Trigger.** Login / Post Login
- **Runtime.** The current recommended Node runtime

Replace the sample with:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://seasketch.org";
  if (event.authorization) {
    const isSuperuser = !!(
      event.authorization.roles &&
      event.authorization.roles.indexOf("seasketch_superuser") !== -1
    );
    api.accessToken.setCustomClaim(`${namespace}/superuser`, isSuperuser);
    api.accessToken.setCustomClaim(
      `${namespace}/email_verified`,
      event.user.email_verified,
    );
    api.accessToken.setCustomClaim(
      `${namespace}/canonical_email`,
      event.user.email,
    );
    api.idToken.setCustomClaim(`${namespace}/superuser`, isSuperuser);
    api.idToken.setCustomClaim(
      `${namespace}/email_verified`,
      event.user.email_verified,
    );
    api.idToken.setCustomClaim(
      `${namespace}/canonical_email`,
      event.user.email,
    );
  }
};
```

The namespace has no trailing slash. A slash produces different claim names, and the API then rejects the token because `https://seasketch.org/canonical_email` is missing.

Deploy the Action. Then open Actions → Triggers → post-login, drop `add-claims` into the flow, and Apply. A deployed Action that is not on the flow does not run.

The API reads the claims from the access token. The client reads the same claims from the ID token. The Action writes both.

## 8. Fill in the env files

For the SeaSketch development tenant, the templates already hold these public values. Copy them and add `AUTH0_CLIENT_SECRET` if you need the Management API. For a tenant you created above, set:

`packages/api/.env`

```
JWKS_URI=https://<domain>/.well-known/jwks.json
JWT_AUD=<api identifier>
JWT_ISS=https://<domain>/
AUTH0_DOMAIN=<domain>
AUTH0_CLIENT_ID=<management application client id>
AUTH0_CLIENT_SECRET=<management application client secret>
```

`packages/client/.env`

```
REACT_APP_AUTH0_DOMAIN=<domain>
REACT_APP_AUTH0_CLIENT_ID=<single-page application client id>
REACT_APP_AUTH0_AUDIENCE=<api identifier>
REACT_APP_AUTH0_SCOPE="openid profile email offline_access"
```

`<domain>` is the tenant domain without `https://`. The audience string matches in both files, and it matches the API identifier from step 2.

Restart `npm run dev` after editing. The API and the client read these files when their processes start.

## 9. Check

- `curl http://localhost:3857/auth_config.json` returns your domain, your management client id, and your audience.
- Open `http://localhost:3000`, sign up, and land back in the app.
- An error that says `https://seasketch.org/canonical_email property not supplied` means the Action is not on the Login flow, or it ran without `event.authorization`. Recheck step 2 and step 7, then sign in again.
- Superuser pages stay closed until the role from step 6 is on that user and they have signed in again.
