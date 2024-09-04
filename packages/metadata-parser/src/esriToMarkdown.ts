export function esriToMarkdown(metadata: any): string {
  const md: string[] = [];

  // Title
  const title =
    metadata?.metadata?.idinfo?.citation?.citeinfo?.title?.[0] || "Untitled";
  md.push(`# ${title}`);

  // Abstract
  const abstract = metadata?.metadata?.idinfo?.descript?.abstract?.[0];
  if (abstract) {
    md.push(`\n**Abstract:** ${abstract}\n`);
  }

  // Purpose
  const purpose = metadata?.metadata?.idinfo?.descript?.purpose?.[0];
  if (purpose) {
    md.push(`\n**Purpose:** ${purpose}\n`);
  }

  // Keywords
  const themeKeywords =
    metadata?.metadata?.idinfo?.keywords?.theme?.[0]?.themekey
      ?.map((key: any) => key)
      ?.join(", ");
  if (themeKeywords) {
    md.push(`\n**Keywords:** ${themeKeywords}\n`);
  }

  // Temporal Coverage
  const beginDate =
    metadata?.metadata?.idinfo?.timeperd?.timeinfo?.rngdates?.begdate?.[0];
  const endDate =
    metadata?.metadata?.idinfo?.timeperd?.timeinfo?.rngdates?.enddate?.[0];
  if (beginDate || endDate) {
    md.push(`\n**Temporal Coverage:**`);
    if (beginDate) md.push(`\n- **Start Date:** ${beginDate}`);
    if (endDate) md.push(`\n- **End Date:** ${endDate}`);
    md.push("\n");
  }

  // Spatial Extent (Bounding Box)
  const west = metadata?.metadata?.spdom?.bounding?.westbc?.[0];
  const east = metadata?.metadata?.spdom?.bounding?.eastbc?.[0];
  const north = metadata?.metadata?.spdom?.bounding?.northbc?.[0];
  const south = metadata?.metadata?.spdom?.bounding?.southbc?.[0];
  if (west || east || north || south) {
    md.push(`\n**Spatial Extent (Bounding Box):**`);
    if (west) md.push(`\n- **West:** ${west}`);
    if (east) md.push(`\n- **East:** ${east}`);
    if (north) md.push(`\n- **North:** ${north}`);
    if (south) md.push(`\n- **South:** ${south}`);
    md.push("\n");
  }

  // Attribute Information (Table)
  const attributes = metadata?.metadata?.eainfo?.detailed?.attr || [];
  if (attributes.length > 0) {
    md.push(`\n## Attribute Information\n`);
    md.push(
      "| Attribute Label | Definition | Domain |\n|-----------------|-------------|--------|\n"
    );
    attributes.forEach((attr: any) => {
      const label = attr?.attrlabl?.[0] || "Unknown";
      const definition = attr?.attrdef?.[0] || "No definition";
      const domain = attr?.attrdomv?.udom?.[0] || "No domain";
      md.push(`| ${label} | ${definition} | ${domain} |\n`);
    });
  }

  // Contact Information (Enhanced Parsing without placeholders)
  const contactInfo = metadata?.metadata?.metainfo?.metc?.cntinfo || {};
  const contactOrg = contactInfo?.cntorgp?.cntorg?.[0];
  const contactPerson = contactInfo?.cntper?.[0];
  const contactPhone = contactInfo?.cntvoice?.[0];
  const contactEmail = contactInfo?.cntemail?.[0];
  const contactAddress = contactInfo?.cntaddr?.[0]?.address?.[0];

  if (
    contactOrg ||
    contactPerson ||
    contactPhone ||
    contactEmail ||
    contactAddress
  ) {
    md.push(`\n## Contact Information\n`);
    if (contactOrg) md.push(`- **Organization:** ${contactOrg}\n`);
    if (contactPerson) md.push(`- **Contact Person:** ${contactPerson}\n`);
    if (contactPhone) md.push(`- **Phone:** ${contactPhone}\n`);
    if (contactEmail) md.push(`- **Email:** ${contactEmail}\n`);
    if (contactAddress) md.push(`- **Address:** ${contactAddress}\n`);
  }

  return md.join("");
}

// Get attribution from Esri metadata
export function getAttribution(metadata: any): string | null {
  // Try to retrieve the organization from the citation info
  const organization =
    metadata?.metadata?.idinfo?.citation?.citeinfo?.origin?.[0];
  if (organization) {
    return organization;
  }

  // Fallback to contact organization if citation doesn't have origin
  const contactOrg =
    metadata?.metadata?.metainfo?.metc?.cntinfo?.cntorgp?.cntorg?.[0];
  return contactOrg || null;
}
