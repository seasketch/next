import { ApolloClient } from "@apollo/client";
import { CreateFileUploadForAboutPageDocument } from "../../generated/graphql";
import axios from "axios";

/**
 * Upload an image file to Cloudflare Images and return the hosted URL.
 * Reuses the same upload infrastructure as the About Page editor.
 */
export async function uploadReportImage(
  client: ApolloClient<any>,
  projectId: number,
  file: File
): Promise<string> {
  const response = await client
    .mutate({
      mutation: CreateFileUploadForAboutPageDocument,
      variables: {
        contentType: file.type,
        filename: file.name,
        fileSizeBytes: file.size,
        projectId,
      },
    })
    .catch((e) => {
      throw new Error(`Failed to create file upload. ${e.message}`);
    });

  const uploadUrl =
    response?.data?.createFileUpload?.cloudflareImagesUploadUrl;
  if (!uploadUrl) {
    throw new Error("Failed to get upload URL");
  }

  const formData = new FormData();
  formData.append("file", file);
  const res = await axios({ url: uploadUrl, method: "POST", data: formData });
  const resData = res.data as Record<string, any> | undefined;

  if (
    resData?.result?.variants &&
    Array.isArray(resData.result.variants)
  ) {
    const variants = resData.result.variants as string[];
    const prosemirrorEmbed = variants.find((v: string) =>
      /prosemirrorEmbed/.test(v)
    );
    if (!prosemirrorEmbed) {
      throw new Error("Could not find prosemirrorEmbed variant");
    }
    // Preload to avoid a flash of broken image
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.src = prosemirrorEmbed;
      img.setAttribute(
        "style",
        "position: absolute; top: -10000px; left: -10000px;"
      );
      img.onload = () => {
        resolve(prosemirrorEmbed);
        document.body.removeChild(img);
      };
      img.onerror = () => {
        resolve(prosemirrorEmbed);
        try {
          document.body.removeChild(img);
        } catch {
          // ignore
        }
      };
      document.body.append(img);
    });
  }
  throw new Error("Could not get variants from upload response");
}

/**
 * Create a bound upload function for use in ProseMirror plugins.
 */
export function createReportImageUploader(
  client: ApolloClient<any>,
  projectId: number,
  onError?: (e: Error) => void
) {
  return async (file: File): Promise<string> => {
    try {
      return await uploadReportImage(client, projectId, file);
    } catch (e) {
      onError?.(e as Error);
      throw e;
    }
  };
}
