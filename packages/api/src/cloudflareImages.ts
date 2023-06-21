// import { CloudflareClient } from "cloudflare-images";

// const client = new CloudflareClient({
//   accountId: process.env.CLOUDFLARE_IMAGES_ACCOUNT,
//   apiKey: process.env.CLOUDFLARE_IMAGES_TOKEN,
// });

export async function getDirectCreatorUploadUrl() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_IMAGES_ACCOUNT}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_IMAGES_TOKEN}`,
      },
    }
  );
  const json = await response.json();
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.result as { id: string; uploadURL: string };
}
