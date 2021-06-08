import { sign, verify } from "../auth/jwks";
import { DBClient } from "../dbClient";
const HOST = process.env.HOST || "seasketch.org";

interface UnsubscribeFromTopicClaims {
  userId: number;
  topicId: number;
}

export async function generateUnsubscribeToken(
  client: DBClient,
  userId: number,
  topicId: number
) {
  const expiration = "60 days";
  return await sign(
    client,
    {
      topicId,
      userId,
    } as UnsubscribeFromTopicClaims,
    expiration,
    HOST
  );
}

export async function unsubscribeFromTopic(client: DBClient, token: string) {
  const claims: UnsubscribeFromTopicClaims = await verify(client, token, HOST);
  if (claims.topicId && claims.userId) {
    await client.query(
      `insert into topic_notification_unsubscribes (topic_id, user_id) values ($1, $2) on conflict do nothing`,
      [claims.topicId, claims.userId]
    );
  } else {
    throw new Error("Invalid token claims");
  }
}

export async function sendQueuedNotifications(client: DBClient) {
  const records = await client.query(
    `select topic_id, user_id from pending_topic_notifications order by created_at, topic_id limit 50`
  );
  // TODO:
  // Batch up into topics
  // get emails for each user
  // create unsubscribe tokens
  // fill in email templates
  // batch send out
}
