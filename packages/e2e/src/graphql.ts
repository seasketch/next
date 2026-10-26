import { APIRequestContext } from "@playwright/test";
import { apiURL } from "./config";

type GraphQLError = { message?: string };

/**
 * Post one operation to the local API. A bearer token is the signed-in user.
 */
export async function graphql<T>(
  request: APIRequestContext,
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await request.post(`${apiURL}/graphql`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { query, variables },
  });
  const body = (await response.json()) as { data?: T; errors?: GraphQLError[] };
  if (!response.ok() || body.errors?.length) {
    const message =
      body.errors?.map((error) => error.message).filter(Boolean).join("\n") ||
      `GraphQL request failed (${response.status()})`;
    throw new Error(message);
  }
  if (!body.data) {
    throw new Error("GraphQL response had no data");
  }
  return body.data;
}
