import { WebClient } from "@slack/web-api";

export async function notifySlackChannel(
  filename: string,
  presignedDownloadUrl: string,
  logs: string,
  bucket: string,
  objectKey: string,
  user: string,
  error: string
) {
  const slack = new WebClient(process.env.SLACK_TOKEN!);

  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL!,
    text: "Upload failed",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "An Upload Failed",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: error,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Processing of this spatial data file failed. It could be that this file format is unsupported, it was corrupted, or there was a problem with SeaSketch.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: filename,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Download file",
            emoji: false,
          },
          value: filename,
          url: presignedDownloadUrl,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Download link expires after 48 hours.\n\nbucket=${bucket}\nkey=${objectKey}\nuser=${user}`,
          },
        ],
      },
    ],
  });

  await slack.files.uploadV2({
    channels: process.env.SLACK_CHANNEL!,
    content: logs,
    filename: `${filename}.logs.txt`,
    title: `${filename} processing logs`,
  });
}
