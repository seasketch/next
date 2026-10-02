# A second production install

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

[Index](README.md) · [Strategy](strategy.md)

## Intent

Running another production SeaSketch on its own domain — `seasketch-eu.com`, say — is a **non-goal** of this campaign. Nothing here deploys a second site, splits the database, or makes CDK target another account.

It is a constraint on the choices the campaign does make. When a decision would force a fork to run a second install, prefer the option that keeps it "the same revision, a different configuration profile, its own Auth0 tenant, database, and storage." Accommodations that are small changes inside work already planned are in scope. A sweep of hardcoded hostnames is not.

## What a second install would be

The same build artifacts, deployed with a different profile: its own domain, Auth0 tenant, database, object storage, queues, and email identity. It shares nothing mutable with `seasketch.org`. It is not a multi-tenant mode inside the current production process, and it is not staging. Staging is a non-production stack of the current install ([environment setup](env-setup.md)).

The client bakes public URLs in at build time, so a second install is a second client build with its own profile — the model we already use. Do not add a runtime configuration service for this.

## Choices to avoid

- A fork, a per-domain branch, or a copied package per site.
- A secrets manifest with exactly two fixed value sets, where "prod" silently means `seasketch.org`.
- A fail-closed check written as a hardcoded belief that one production exists. The production identifiers it refuses are data on the `seasketch.org` profile.
- Reusing the `seasketch.org` Auth0 tenant, database, buckets, or queues to "configure" another domain.
- Renaming the `https://seasketch.org/…` claim namespace to a site hostname. It is an identifier shared by every install.
- New code that treats `prod` as the only production ACL namespace, or that adds new hardcoded hostnames.

## Accommodations inside planned work

| While doing | Accommodation |
| --- | --- |
| [Secrets manifest](secrets-management.md) | Values are named profiles, so another production is a new profile, not a schema change. Hostnames and identifiers that are already variables are in the manifest: `CLIENT_DOMAIN`, `ISSUER`, `JWT_ISS`, `JWT_AUD`, the Auth0 domain and audience, `SES_EMAIL_SOURCE`, bucket names, queue URLs, `TILES_ACL_NAMESPACE` |
| [Auth0 split](auth0.md) | The production issuer (`seasketch.auth0.com`) and audience identifier (`https://api.seasketch.org`) are values on the `seasketch.org` profile, not constants in code |
| Fail-closed checks | They refuse "production identifiers of an install this process is not," read from profile data |
| [Golden snapshot](integration-testing.md) | Fixture owners are synthetic. Another install administers them through its own superuser claim, not by matching a snapshot `sub` |
| Any new hostname, bucket, queue, or email address | It is a manifest variable, not a new literal |
| A line already being edited that defaults `ISSUER` to `seasketch.org` | Drop the literal default and require the variable. Do not go looking for other instances |

## Known debt, left alone

Hardcoded production hostnames are widespread: `uploads.seasketch.org`, `tiles.seasketch.org`, and `overlay.seasketch.org` in API plugins and tasks; the production API host `api.seasket.ch` in infra, email templates, and the deploy gate; `ISSUER || "seasketch.org"` defaults; host filters in visitor metrics; the public WoRMS parquet base URL. Parameterizing them is a later project. JSON schema `$id` values under `https://seasketch.org/schemas/…` are identifiers, not deployment URLs, and stay.

CDK's single-account layout and the deploy workflow's structure stay as they are. Do not deepen that coupling while passing through: bucket names and domains introduced by this campaign come from configuration.

## Decisions

- This campaign does not deploy a second install.
- When a choice would force a fork, prefer the same revision with a different configuration profile.
- New hostnames, buckets, queues, and issuers introduced by this campaign are manifest variables.
- Parameterizing the hardcoded hostnames already in the tree is a later project.

## Open questions

None. This file is a constraint on the other decisions, not a phase of work.

## Exit criteria

- **Throughout:** No pull request in this campaign deploys a second site, and none adds a new hardcoded production hostname, bucket, queue, or issuer.
