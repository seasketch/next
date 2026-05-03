/**
 * Unwraps Apollo Client errors so the UI shows the server-provided message
 * instead of a generic "ApolloError: ..." wrapper.
 */
export function inviteFlowErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const anyErr = error as {
      graphQLErrors?: { message?: string }[];
      networkError?: { message?: string; result?: { errors?: { message?: string }[] } };
    };
    if (anyErr.graphQLErrors?.length) {
      return anyErr.graphQLErrors
        .map((e) => e.message)
        .filter(Boolean)
        .join("\n");
    }
    const fromNetwork = anyErr.networkError?.result?.errors;
    if (Array.isArray(fromNetwork) && fromNetwork[0]?.message) {
      return fromNetwork.map((e) => e.message).join("\n");
    }
    if (anyErr.networkError?.message) {
      return anyErr.networkError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
