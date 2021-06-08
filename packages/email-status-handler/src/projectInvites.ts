import { projectInvites } from "@seasketch/api";
import { getClient } from "@seasketch/lambda-db-client";

export async function updateStatusHandler(event: {
  Records: { Sns: { Message: string } }[];
}) {
  if (!event.Records || !event.Records.length) {
    throw new Error("Could not access event.Records");
  }
  if (event.Records.length > 1) {
    throw new Error("More than one record sent to lambda");
  }
  if (!event.Records[0].Sns || !event.Records[0].Sns.Message) {
    throw new Error("Could not access event.Records[0].Sns.Message");
  }
  const message: {
    notificationType: "Bounce" | "Complaint" | "Delivery";
    mail: { messageId: string; source: string; destination: string[] };
    bounce?: {
      bounceType: "Undetermined" | "Permanent" | "Transient";
      bounceSubType:
        | "Undetermined"
        | "General"
        | "NoEmail"
        | "Suppressed"
        | "OnAccountSuppressionList"
        | "MailboxFull"
        | "MessageTooLarge"
        | "ContentRejected"
        | "AttachmentRejected";
    };
    complaint?: {
      complaintSubType: "OnAccountSuppressionList" | null;
    };
    delivery?: {};
  } = JSON.parse(event.Records[0].Sns.Message);
  try {
    const client = await getClient();
    await projectInvites.updateStatus(
      client,
      message.mail.messageId,
      message.notificationType
    );
    return { messageId: message.mail.messageId };
  } catch (e) {
    throw e;
  }
}
