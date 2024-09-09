import { createParagraphNode } from "./createParagraphNode";

// Helper function to safely access arrays
const getFirst = (value: any) =>
  Array.isArray(value) && value.length > 0 ? value[0] : "";

// Function to create a text node
function createTextNode(content: string) {
  return {
    type: "text",
    text: content,
  };
}

// Function to create a heading node
function createHeadingNode(content: any[], level: number) {
  return {
    type: "heading",
    attrs: { level },
    content: content,
  };
}

// Function to create a table cell node
function createTableCellNode(content: any[]) {
  return {
    type: "table_cell",
    content: [createParagraphNode(content)],
  };
}

// Function to create a table row node
function createTableRowNode(cells: any[]) {
  return {
    type: "table_row",
    content: cells,
  };
}

// Function to create a table node
function createTableNode(rows: any[]) {
  return {
    type: "table",
    content: rows,
  };
}

// Function to create a bullet list node
function createBulletListNode(items: any[]) {
  return {
    type: "bullet_list",
    content: items,
  };
}

// Function to create list item node
function createListItemNode(content: any[]) {
  return {
    type: "list_item",
    content: [createParagraphNode(content)],
  };
}

const parseTopicCategories = (categories: any): string => {
  const topicCategories =
    categories
      ?.map((category: any) => category["gmd:MD_TopicCategoryCode"]?.[0])
      .join(", ") || "";
  return topicCategories;
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

// Main function to generate ProseMirror nodes from ISO 19139 metadata
export function iso19139ToProseMirror(metadata: any) {
  if ("gmd:MD_Metadata" in metadata) {
    metadata = metadata["gmd:MD_Metadata"];
  }

  const doc: any = { type: "doc", content: [] };

  // Title
  const title = getFirst(
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:citation"
    ][0]["gmd:CI_Citation"][0]["gmd:title"][0]["gco:CharacterString"]
  );
  // if (title) {
  //   doc.content.push(createHeadingNode([createTextNode(title)], 1));
  // }

  // Abstract
  const abstract = getFirst(
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:abstract"
    ][0]["gco:CharacterString"]
  );
  if (abstract) {
    doc.content.push(createHeadingNode([createTextNode("Abstract")], 2));
    doc.content.push(createParagraphNode([createTextNode(abstract)]));
  }

  // Keywords
  const keywords = metadata["gmd:identificationInfo"][0][
    "gmd:MD_DataIdentification"
  ][0]["gmd:descriptiveKeywords"]?.[0]["gmd:MD_Keywords"][0]["gmd:keyword"]
    ?.map((kw: any) => kw["gco:CharacterString"][0])
    .join(", ");
  if (keywords) {
    doc.content.push(createHeadingNode([createTextNode("Keywords")], 2));
    doc.content.push(createParagraphNode([createTextNode(keywords)]));
  }

  const topicCategories =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:topicCategory"
    ];
  if (topicCategories) {
    doc.content.push(
      createHeadingNode([createTextNode("Topic Categories")], 2)
    );
    doc.content.push(
      createParagraphNode([
        createTextNode(parseTopicCategories(topicCategories)),
      ])
    );
  }

  // Use Constraints
  const resourceConstraints =
    metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0][
      "gmd:resourceConstraints"
    ];
  if (resourceConstraints) {
    const useConstraints = resourceConstraints
      .map((constraint: any) =>
        parseConstraints(
          constraint["gmd:MD_LegalConstraints"]?.[0] ||
            constraint["gmd:MD_SecurityConstraints"]?.[0] ||
            constraint["gmd:MD_Constraints"]?.[0]
        )
      )
      .join("\n");

    if (useConstraints) {
      console.log("use constraints", useConstraints);
      doc.content.push(
        createHeadingNode([createTextNode("Use Constraints")], 2)
      );
      doc.content.push(createParagraphNode([createTextNode(useConstraints)]));
    }
  }

  const dataQualityInfo =
    metadata["gmd:dataQualityInfo"]?.[0]["gmd:DQ_DataQuality"]?.[0];
  if (dataQualityInfo) {
    const lineage =
      dataQualityInfo["gmd:lineage"]?.[0]["gmd:LI_Lineage"]?.[0][
        "gmd:statement"
      ]?.[0]["gco:CharacterString"]?.[0] || "";
    const report = dataQualityInfo["gmd:report"]?.[0];
    if (lineage || report) {
      doc.content.push(createHeadingNode([createTextNode("Data Quality")], 2));
      if (lineage) {
        doc.content.push(createParagraphNode([createTextNode(lineage)]));
      }
      if (report) {
        const explanation =
          report["gmd:DQ_Element"]?.[0]["gmd:measureDescription"]?.[0][
            "gco:CharacterString"
          ]?.[0] || "";
        if (explanation) {
          doc.content.push(createParagraphNode([createTextNode(explanation)]));
        }
      }
    }
  }

  // Attribute Information (Table using ProseMirror Table Schema)
  const eainfo = getFirst(metadata?.metadata?.eainfo);
  const detailed = eainfo?.detailed?.[0] || {};
  const attributes = detailed?.attr || [];
  if (attributes.length > 0) {
    doc.content.push(
      createHeadingNode([createTextNode("Attribute Information")], 2)
    );

    const tableRows: any[] = [];

    // Create header row
    const headerRow = createTableRowNode([
      createTableCellNode([createTextNode("Attribute Label")]),
      createTableCellNode([createTextNode("Definition")]),
      createTableCellNode([createTextNode("Domain")]),
    ]);
    tableRows.push(headerRow);

    // Create data rows
    attributes.forEach((attr: any) => {
      const label = getFirst(attr?.attrlabl) || "Unknown";
      const definition = getFirst(attr?.attrdef) || "No definition";

      let domain = "No domain";
      const attrdomv = getFirst(attr?.attrdomv);
      if (attrdomv?.udom) {
        domain = getFirst(attrdomv?.udom);
      } else if (attrdomv?.rdom) {
        const rdommin = getFirst(attrdomv?.rdom?.rdommin);
        const rdommax = getFirst(attrdomv?.rdom?.rdommax);
        if (rdommin && rdommax) {
          domain = `Range: ${rdommin} to ${rdommax}`;
        } else if (rdommin || rdommax) {
          domain = `Value: ${rdommin || rdommax}`;
        }
      }

      const dataRow = createTableRowNode([
        createTableCellNode([createTextNode(label)]),
        createTableCellNode([createTextNode(definition)]),
        createTableCellNode([createTextNode(domain)]),
      ]);
      tableRows.push(dataRow);
    });

    const tableNode = createTableNode(tableRows);
    doc.content.push(tableNode);
  }

  // Contact Information
  const contact = metadata["gmd:contact"][0]["gmd:CI_ResponsibleParty"][0];
  const contactInfo = parseContact(contact);
  const contactInfoContent = [];
  doc.content.push(
    createHeadingNode([createTextNode("Contact Information")], 2)
  );
  if (contactInfo.name)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Name: ${contactInfo.name}`)])
    );
  if (contactInfo.organization)
    contactInfoContent.push(
      createListItemNode([
        createTextNode(`Organization: ${contactInfo.organization}`),
      ])
    );
  if (contactInfo.position)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Position: ${contactInfo.position}`)])
    );
  if (contactInfo.phone)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Phone: ${contactInfo.phone}`)])
    );
  if (contactInfo.address)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Address: ${contactInfo.address}`)])
    );
  if (contactInfo.city)
    contactInfoContent.push(
      createListItemNode([createTextNode(`City: ${contactInfo.city}`)])
    );
  if (contactInfo.postalCode)
    contactInfoContent.push(
      createListItemNode([
        createTextNode(`Postal Code: ${contactInfo.postalCode}`),
      ])
    );
  if (contactInfo.country)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Country: ${contactInfo.country}`)])
    );
  if (contactInfo.email)
    contactInfoContent.push(
      createListItemNode([createTextNode(`Email: ${contactInfo.email}`)])
    );
  doc.content.push(createBulletListNode(contactInfoContent));

  return {
    title,
    doc,
    attribution: getAttribution(metadata),
  };
}

// Get attribution from ISO 19139 metadata
export function getAttribution(metadata: any): string | null {
  if ("gmd:MD_Metadata" in metadata) {
    metadata = metadata["gmd:MD_Metadata"];
  }
  const contact = metadata?.["gmd:contact"]?.[0];

  const responsibleParty = contact?.["gmd:CI_ResponsibleParty"]?.[0];
  // Try to retrieve the responsible organization
  const organization =
    responsibleParty["gmd:organisationName"]?.[0]["gco:CharacterString"]?.[0];
  if (organization) {
    return organization;
  }

  // Fallback to other contact individual info if available
  const individual =
    responsibleParty?.["gmd:individualName"]?.[0]["gco:CharacterString"]?.[0];
  return individual || null;
}

// Helper functions for parsing contact and constraints
function parseContact(contact: any) {
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
}

function parseConstraints(constraints: any): string {
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
    constraintsSummary += `Use Limitations: ${useLimitations}\n`;
  }
  if (accessConstraints) {
    constraintsSummary += `Access Constraints: ${accessConstraints}\n`;
  }
  if (useConstraints) {
    constraintsSummary += `Use Constraints: ${useConstraints}\n`;
  }

  return constraintsSummary;
}
