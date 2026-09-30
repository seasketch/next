# Auth0

> [2026 campaign record](README.md). Archived when the campaign ends. A later refactor supersedes this folder instead of revising it.

[Index](README.md) · [Strategy](strategy.md)

## Intent

Every human login outside the production site — laptops, cloud agents, staging — goes to a non-production Auth0 tenant. No development credential can read or modify production users, and no token minted outside production is accepted by the production API.

Automated tests go further and do not touch Auth0 at all. That mechanism is `E2E_TEST_MODE`, described in [integration testing](integration-testing.md). The API side of this document — booting without Auth0, and one place that talks to the Management API — is what makes test mode possible.

## Starting point (2026)

Development uses the production tenant. The API template sets `JWKS_URI` and `JWT_ISS` to `seasketch.auth0.com`, and the API and client both use the audience `https://api.seasketch.org`. The client id, client secret, and domain that 1Password injects for development are the production application's. CI's schema-drift job and client build receive the same values.

The API does more than validate tokens. It calls the Auth0 Management API with `read:users` and `update:users`:

- `canonicalEmail` on `EmailNotificationPreference` looks up the user's email (`auth/auth0.ts`).
- Accepting a project invite marks an unverified user's email as verified (`invites/projectInvites.ts`).
- Email verification links do the same (`emailVerification.ts`, and `verifyEmailMiddleware`).

Those call sites construct their own Management clients, and `auth/auth0.ts` constructs one when the module is imported, so the API expects Auth0 configuration just to start. Anyone with the development `.env` can update production users.

SeaSketch-specific claims come from an Auth0 rule or Action: `https://seasketch.org/canonical_email`, `https://seasketch.org/email_verified`, and `https://seasketch.org/superuser`. Superuser is a flag on the user in the tenant. `userAccountMiddleware` and `IsSuperuserPlugin` trust those claims after `authorizationMiddleware` has checked issuer, audience, and signature.

Sharing the tenant means:

- A development or staging signup creates a production user.
- Verifying an email from a local API writes to the production user record.
- Changing the rule to try a new claim changes production login.
- A development token carries the production issuer and audience, so the production API accepts it.
- Putting those keys into a cloud agent's secret store multiplies who holds a production management secret.

A second *application* in the production tenant fixes none of this. The user directory, the Management API, and the superuser flag are tenant-wide.

## Design

**Two tenants for this install.**

| | Production | Non-production |
| --- | --- | --- |
| Used by | The deployed API and client | Laptops, cloud agents, staging |
| Issuer | `seasketch.auth0.com` | A different Auth0 domain |
| Audience | `https://api.seasketch.org` | A different identifier, so a copied token fails the production audience check on its own |
| Management client | Production deploy only | Shared development secret, scoped to the non-production directory |
| SPA callbacks | Production origins | `localhost` origins, plus staging when it exists |

One non-production tenant serves laptops and staging. Start with one SPA application and one API identifier in it.

**Claims keep their names.** Recreate the rule or Action on the new tenant with the same `https://seasketch.org/…` claim names. The namespace is an identifier shared by every install, not the site's hostname. Issuer and audience are what differ. Staff who need superuser for development are marked superuser in the non-production tenant.

**One Management API module.** The call sites above go through a single module that creates its client lazily. When Auth0 management is unconfigured, the features that need it report themselves unavailable and the API still starts. In `E2E_TEST_MODE`, the module is replaced by a fake backed by the local database, so invite acceptance and `canonicalEmail` work for test users who exist in no Auth0 tenant.

**Setup refuses production identifiers.** Outside a production deploy, `JWT_ISS`, `JWKS_URI`, the Auth0 domain, and the audience must not match the production profile's values. This check sits with the other fail-closed checks in [secrets](secrets-management.md).

**User ids do not carry over.** `sub` is per tenant. A developer's existing local database has users created by production logins. After the cutover, a non-production login creates a new user row. Old rows can be ignored. The golden snapshot made after the cutover is taken from a database that has been used with the new tenant, so its fixture projects are reachable by non-production superusers.

**The preview workflow is unchanged.** `.github/workflows/preview-build.yml` builds a client against a shared API with the production tenant. It stays that way while that API is production. It is not a reason for development to use production keys, and it is not staging.

## Sequencing

The smoke job does not wait for the new tenant, because it uses test mode. It must still never receive the production management secret.

The tenant is a phase 1 exit criterion. No cloud agent or new laptop gets a default profile containing production Auth0 values. Until the tenant exists, existing laptops may keep their current keys as a temporary exception. Those keys are not copied into CI or into any agent's secret store.

Staging, in phase 5, uses the same non-production tenant.

## Decisions

- A separate tenant, not a second application on `seasketch.auth0.com`.
- Production management credentials appear only in the production deploy environment.
- The API starts without Auth0 management configured, and all Management API calls go through one module.
- Automated tests hold no Auth0 secrets or user passwords.
- Claim names stay `https://seasketch.org/…`. Issuer and audience change per install.
- One non-production tenant for laptops, agents, and staging. A future production install on another domain would get its own production tenant ([second production install](second-install.md)).

## Open questions

- *(Phase 1)* Tenant name, region, and the non-production audience identifier.
- *(Phase 1)* Whether the existing rule can be exported as is, or has to be rewritten as an Action.
- *(Phase 1)* Which staff accounts are superuser in the non-production tenant before the first post-cutover snapshot.

## Exit criteria

- **Phase 1:** The API starts with Auth0 management unset. The smoke job holds no Auth0 secrets. The default profile for a new machine or agent is the non-production tenant. Setup refuses production Auth0 identifiers outside a production deploy.
- **Phase 5:** Staging login uses the non-production tenant. The production tenant is unchanged.
