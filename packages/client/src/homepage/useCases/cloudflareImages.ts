/* eslint-disable i18next/no-literal-string */

export const CLOUDFLARE_IMAGES =
  "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw";

export function cloudflareImage(id: string, variant: string) {
  return `${CLOUDFLARE_IMAGES}/${id}/${variant}`;
}
