import { readFileSync } from "fs";
import { parseStringPromise } from "xml2js";

interface Contact {
  name: string;
  organization: string;
  position: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
}

const parseContact = (contact: any): Contact => {
  const contactInfo = contact["gmd:contactInfo"]?.[0]["gmd:CI_Contact"]?.[0];

  return {
    name: contact["gmd:individualName"]?.[0]["gco:CharacterString"]?.[0] || "",
    organization:
      contact["gmd:organisationName"]?.[0]["gco:CharacterString"]?.[0] || "",
    position:
      contact["gmd:positionName"]?.[0]["gco:CharacterString"]?.[0] || "",
    phone:
      contactInfo?.["gmd:phone"]?.[0]["gmd:CI_Telephone"]?.[0]["gmd:voice"]
        ?.map((p: any) => p["gco:CharacterString"]?.[0])
        .join(", ") || "",
    address:
      contactInfo?.["gmd:address"]?.[0]["gmd:CI_Address"]?.[0][
        "gmd:deliveryPoint"
      ]
        ?.map((p: any) => p["gco:CharacterString"]?.[0])
        .join(", ") || "",
    city:
      contactInfo?.["gmd:address"]?.[0]["gmd:CI_Address"]?.[0]["gmd:city"]?.[0][
        "gco:CharacterString"
      ]?.[0] || "",
    postalCode:
      contactInfo?.["gmd:address"]?.[0]["gmd:CI_Address"]?.[0][
        "gmd:postalCode"
      ]?.[0]["gco:CharacterString"]?.[0] || "",
    country:
      contactInfo?.["gmd:address"]?.[0]["gmd:CI_Address"]?.[0][
        "gmd:country"
      ]?.[0]["gco:CharacterString"]?.[0] || "",
    email:
      contactInfo?.["gmd:address"]?.[0]["gmd:CI_Address"]?.[0][
        "gmd:electronicMailAddress"
      ]
        ?.map((e: any) => e["gco:CharacterString"]?.[0])
        .join(", ") || "",
  };
};

const parseConstraints = (constraints: any): string => {
  const useLimitations =
    constraints["gmd:useLimitation"]
      ?.map((limitation: any) => limitation["gco:CharacterString"][0])
      .join("; ") || "";
  const accessConstraints =
    constraints["gmd:accessConstraints"]
      ?.map(
        (constraint: any) =>
          constraint["gmd:MD_RestrictionCode"]?.[0]?.["$"]?.["codeListValue"]
      )
      .join(", ") || "";
  const useConstraints =
    constraints["gmd:useConstraints"]
      ?.map(
        (constraint: any) =>
          constraint["gmd:MD_RestrictionCode"]?.[0]?.["$"]?.["codeListValue"]
      )
      .join(", ") || "";

  let constraintsSummary = "";

  if (useLimitations) {
    constraintsSummary += `- **Use Limitations:** ${useLimitations}\n`;
  }
  if (accessConstraints) {
    constraintsSummary += `- **Access Constraints:** ${accessConstraints}\n`;
  }
  if (useConstraints) {
    constraintsSummary += `- **Use Constraints:** ${useConstraints}\n`;
  }

  return constraintsSummary;
};

const parseTopicCategories = (categories: any): string => {
  const topicCategories =
    categories
      ?.map((category: any) => category["gmd:MD_TopicCategoryCode"]?.[0])
      .join(", ") || "";
  return topicCategories ? `\n**Topic Categories:** ${topicCategories}\n` : "";
};

const parseDataQuality = (dataQualityInfo: any): string => {
  const lineage =
    dataQualityInfo["gmd:lineage"]?.[0]["gmd:LI_Lineage"]?.[0][
      "gmd:statement"
    ]?.[0]["gco:CharacterString"]?.[0] || "";
  const report = dataQualityInfo["gmd:report"]?.[0];
  let dataQuality = "";

  if (lineage) {
    dataQuality += `\n**Lineage:** ${lineage}\n`;
  }

  if (report) {
    const explanation =
      report["gmd:DQ_Element"]?.[0]["gmd:measureDescription"]?.[0][
        "gco:CharacterString"
      ]?.[0] || "";
    if (explanation) {
      dataQuality += `\n**Quality Report:** ${explanation}\n`;
    }
  }

  return dataQuality ? `## Data Quality\n${dataQuality}` : "";
};

const generateMarkdown = (metadata: any): string => {
  const md: string[] = [];

  // Title
  const title =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:citation"
    ][0]["gmd:CI_Citation"][0]["gmd:title"][0]["gco:CharacterString"][0];
  md.push(`# ${title}`);

  // Abstract
  const abstract =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:abstract"
    ][0]["gco:CharacterString"][0];
  md.push(`\n**Abstract:** ${abstract}\n`);

  // Keywords
  const keywords = metadata["gmd:identificationInfo"][0][
    "gmd:MD_DataIdentification"
  ][0]["gmd:descriptiveKeywords"]?.[0]["gmd:MD_Keywords"][0]["gmd:keyword"]
    ?.map((kw: any) => kw["gco:CharacterString"][0])
    .join(", ");
  if (keywords) {
    md.push(`\n**Keywords:** ${keywords}\n`);
  }

  // Topic Categories
  const topicCategories =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:topicCategory"
    ];
  if (topicCategories) {
    md.push(parseTopicCategories(topicCategories));
  }

  // Temporal Information
  const temporalExtent =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:extent"
    ]?.[0]["gmd:EX_Extent"]?.[0]["gmd:temporalElement"]?.[0][
      "gmd:EX_TemporalExtent"
    ]?.[0]["gmd:extent"]?.[0]["gml:TimePeriod"]?.[0];
  if (temporalExtent) {
    const begin = temporalExtent["gml:beginPosition"]?.[0];
    const end = temporalExtent["gml:endPosition"]?.[0];
    md.push(
      `\n**Temporal Coverage:**\n- **Start Date:** ${begin}\n- **End Date:** ${end}\n`
    );
  }

  // Spatial Extent (Bounding Box)
  const boundingBox =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:extent"
    ]?.[0]["gmd:EX_Extent"]?.[0]["gmd:geographicElement"]?.[0][
      "gmd:EX_GeographicBoundingBox"
    ]?.[0];
  if (boundingBox) {
    const west = boundingBox["gmd:westBoundLongitude"]?.[0]["gco:Decimal"][0];
    const east = boundingBox["gmd:eastBoundLongitude"]?.[0]["gco:Decimal"][0];
    const south = boundingBox["gmd:southBoundLatitude"]?.[0]["gco:Decimal"][0];
    const north = boundingBox["gmd:northBoundLatitude"]?.[0]["gco:Decimal"][0];
    md.push(
      `\n**Spatial Extent (Bounding Box):**\n- **West:** ${west}\n- **East:** ${east}\n- **South:** ${south}\n- **North:** ${north}\n`
    );
  }

  // Data Quality Information (including Lineage)
  const dataQualityInfo =
    metadata["gmd:dataQualityInfo"]?.[0]["gmd:DQ_DataQuality"]?.[0];
  if (dataQualityInfo) {
    const dataQualityMarkdown = parseDataQuality(dataQualityInfo);
    if (dataQualityMarkdown) {
      md.push(dataQualityMarkdown);
    }
  }

  // Contact Information
  const contact = metadata["gmd:contact"][0]["gmd:CI_ResponsibleParty"][0];
  const contactInfo = parseContact(contact);
  md.push(`## Contact Information\n`);
  md.push(`- **Name:** ${contactInfo.name}`);
  md.push(`- **Organization:** ${contactInfo.organization}`);
  md.push(`- **Position:** ${contactInfo.position}`);
  md.push(`- **Phone:** ${contactInfo.phone}`);
  md.push(`- **Address:** ${contactInfo.address}`);
  md.push(`- **City:** ${contactInfo.city}`);
  md.push(`- **Postal Code:** ${contactInfo.postalCode}`);
  md.push(`- **Country:** ${contactInfo.country}`);
  md.push(`- **Email:** ${contactInfo.email}`);

  // Resource Constraints
  const resourceConstraints =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:resourceConstraints"
    ];
  if (resourceConstraints) {
    const constraintsMarkdown = resourceConstraints
      .map((constraint: any) =>
        parseConstraints(
          constraint["gmd:MD_LegalConstraints"]?.[0] ||
            constraint["gmd:MD_SecurityConstraints"]?.[0] ||
            constraint["gmd:MD_Constraints"]?.[0]
        )
      )
      .join("\n");
    if (constraintsMarkdown) {
      md.push(`\n## Resource Constraints\n${constraintsMarkdown}`);
    }
  }

  return md.join("\n");
};

const isIso19139Metadata = (xml: any): boolean => {
  return xml && xml["gmd:MD_Metadata"];
};

/**
 *
 * @param xmlFilePath
 * @returns
 */
export const iso19139ToMarkdown = async (
  xmlFilePath: string
): Promise<string> => {
  try {
    const xml = readFileSync(xmlFilePath, "utf-8");
    const result = await parseStringPromise(xml);
    const metadata = result["gmd:MD_Metadata"];

    if (!isIso19139Metadata(result)) {
      throw new Error(
        "The provided file is not a valid ISO 19139 metadata file."
      );
    }

    const markdown = generateMarkdown(metadata);
    return markdown;
  } catch (error: any) {
    throw new Error(`Error processing XML: ${error.message}`);
  }
};
