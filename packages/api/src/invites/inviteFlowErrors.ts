/**
 * Invite flow errors: callers see a concise `message` over GraphQL; operators get
 * structured logs and chained `cause` for the underlying failure.
 */

function readPgCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

function readOriginalMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export type InviteFlowLogExtra = Record<string, unknown>;

/**
 * Logs the real backend failure for troubleshooting (logs support correlation).
 * Call this whenever replacing or masking an error for end users.
 */
export function logInviteFlowBackendError(
  phase: string,
  err: unknown,
  extra?: InviteFlowLogExtra
): void {
  const payload: InviteFlowLogExtra = {
    phase,
    inviteFlow: true,
    ...extra,
  };
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") payload.originalMessage = o.message;
    if (typeof o.code === "string") payload.pgCode = o.code;
    if (typeof o.detail === "string") payload.pgDetail = o.detail;
    if (typeof o.hint === "string") payload.pgHint = o.hint;
    if (typeof o.constraint === "string") payload.pgConstraint = o.constraint;
    if (typeof o.table === "string") payload.pgTable = o.table;
    if (typeof o.column === "string") payload.pgColumn = o.column;
    if (typeof o.severity === "string") payload.pgSeverity = o.severity;
    if (typeof o.routine === "string") payload.pgRoutine = o.routine;
    if (typeof o.position === "string") payload.pgPosition = o.position;
  } else {
    payload.originalMessage = String(err);
  }
  console.error("[inviteFlow]", payload);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}

/**
 * User-visible GraphQL error message, with original failure attached as
 * `cause` (visible to Sentry and Node logging; not serialized to browsers).
 */
export function publicInviteError(
  publicMessage: string,
  original: unknown
): Error {
  const wrapped = new Error(publicMessage);
  (wrapped as Error & { cause?: unknown }).cause = original;
  return wrapped;
}

/** Used when verifyProjectInvite catches JWT verification failures. */
export function mapJwtVerificationError(err: unknown): Error {
  const msg = readOriginalMessage(err);
  // Keep the word "expired" so the client can route to IngressState.Expired
  if (/jwt expired|token expired/i.test(msg)) {
    return err instanceof Error ? err : new Error(msg);
  }

  let friendly: string;
  if (
    /invalid signature|invalid token|jwt malformed|must indicate key id/i.test(
      msg
    )
  ) {
    friendly =
      "This invitation link is invalid or could not be verified. Use the link from your most recent invitation email, or ask a project administrator to resend your invitation.";
  } else if (/Could not find private key|Error retrieving public key/i.test(msg)) {
    friendly =
      "This invitation could not be verified right now due to a server configuration issue. Please try again later or ask a project administrator to resend your invitation.";
  } else {
    friendly =
      "This invitation link could not be verified. Use the link from your most recent invitation email, or ask a project administrator to resend your invitation.";
  }
  logInviteFlowBackendError("mapJwtVerificationError", err, {
    userFacing: "mapped",
  });
  return publicInviteError(friendly, err);
}

const SESSION_HINT =
  "Try signing out of SeaSketch completely, signing back in, and then opening the invitation link from your email again.";

/** Maps DB / RLS failures from confirmProjectInvite and related queries. */
export function mapInviteConfirmationError(err: unknown): Error {
  const msg = readOriginalMessage(err);
  const code = readPgCode(err);

  if (code === "22P02") {
    logInviteFlowBackendError("mapInviteConfirmationError", err, {
      userFacing: "mapped",
      mappedAs: "invalid_session_integer",
    });
    return publicInviteError(
      `Your sign-in session could not be validated. ${SESSION_HINT}`,
      err
    );
  }
  if (
    code === "42501" ||
    /permission denied for table/i.test(msg) ||
    /^permission denied$/i.test(msg.trim())
  ) {
    logInviteFlowBackendError("mapInviteConfirmationError", err, {
      userFacing: "mapped",
      mappedAs: "permission_denied",
    });
    return publicInviteError(
      `Your session does not have permission to complete this invitation. ${SESSION_HINT}`,
      err
    );
  }

  if (/not signed in/i.test(msg)) {
    logInviteFlowBackendError("mapInviteConfirmationError", err, {
      userFacing: "mapped",
      mappedAs: "not_signed_in",
    });
    return publicInviteError(
      "You must be signed in to accept this invitation. If you just registered or signed in, open the invitation link again after you are fully logged in.",
      err
    );
  }
  if (/cannot find invite with id/i.test(msg)) {
    logInviteFlowBackendError("mapInviteConfirmationError", err, {
      userFacing: "mapped",
      mappedAs: "invite_missing",
    });
    return publicInviteError(
      "This invitation is no longer valid. It may have been replaced or removed. Please use the link from the most recent invitation email, or ask a project administrator to resend your invitation.",
      err
    );
  }
  if (/invite has already been used|already been accepted/i.test(msg)) {
    logInviteFlowBackendError("mapInviteConfirmationError", err, {
      userFacing: "mapped",
      mappedAs: "already_used",
    });
    return publicInviteError(
      "This invitation has already been accepted. If you still need access, ask a project administrator for help.",
      err
    );
  }

  return err instanceof Error ? err : new Error(msg);
}
