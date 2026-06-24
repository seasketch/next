/* eslint-disable i18next/no-literal-string */
import { Helmet } from "react-helmet";

const SITE_URL = "https://www.seasketch.org";
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo512.png`;

type SiteHelmetProps = {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
};

export default function SiteHelmet({
  title,
  description,
  path = "/",
  ogImage = DEFAULT_OG_IMAGE,
}: SiteHelmetProps) {
  const pageTitle = title.includes("SeaSketch") ? title : `${title} | SeaSketch`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const resolvedOgImage = ogImage.startsWith("http")
    ? ogImage
    : `${SITE_URL}${ogImage}`;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <link rel="canonical" href={canonicalUrl} />
      <meta name="description" content={description} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={resolvedOgImage} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedOgImage} />
    </Helmet>
  );
}
