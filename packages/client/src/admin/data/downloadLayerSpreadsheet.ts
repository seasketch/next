export function layerCatalogCsvUrl(
  graphqlEndpoint: string,
  slug: string
): string {
  // eslint-disable-next-line i18next/no-literal-string
  const base = graphqlEndpoint.replace(/\/graphql\/?$/, "");
  // eslint-disable-next-line i18next/no-literal-string
  return `${base}/layers/${encodeURIComponent(slug)}.csv`;
}

export async function downloadLayerSpreadsheet(
  slug: string,
  accessToken: string
): Promise<void> {
  const endpoint = process.env.REACT_APP_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    throw new Error("missing-endpoint");
  }
  const response = await fetch(layerCatalogCsvUrl(endpoint, slug), {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // eslint-disable-next-line i18next/no-literal-string
  link.download = `${slug}-layers.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
