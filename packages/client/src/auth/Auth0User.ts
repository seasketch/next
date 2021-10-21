import { User } from "@auth0/auth0-react";

export type Auth0User = {
  /**
   * Whether the current session should be considered a superuser (on the SeaSketch team)
   */
  "https://seasketch.org/superuser": boolean;
  /** Email used to register */
  "https://seasketch.org/canonical_email": string;
  /** Emails can be verified by auth0 or through following a project or survey invite */
  "https://seasketch.org/email_verified": string;
} & User;
