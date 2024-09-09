import { createParagraphNode } from "./createParagraphNode";

// Helper function to safely access arrays
const getFirst = (value: any) =>
  Array.isArray(value) && value.length > 0 ? value[0] : "";

// Function to create a text node
function createTextNode(content: string) {
  if (content === "") {
    content = "     ";
  }
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

// Main function to generate ProseMirror nodes from Esri metadata
export function fgdcToProseMirror(metadata: any) {
  const doc: any = { type: "doc", content: [] };

  // Title
  const idinfo = getFirst(metadata?.metadata?.idinfo);
  const citation = getFirst(idinfo?.citation);
  const citeinfo = getFirst(citation?.citeinfo);
  const title = getFirst(citeinfo?.title);
  // if (title) {
  //   doc.content.push(createHeadingNode([createTextNode(title)], 1));
  // }

  // Abstract
  const descript = getFirst(idinfo?.descript);
  const abstract = getFirst(descript?.abstract);
  if (abstract) {
    doc.content.push(createHeadingNode([createTextNode("Abstract")], 2));
    doc.content.push(
      createParagraphNode([
        createTextNode(abstract.split("Attribute Fields:")[0]),
      ])
    );
  }

  // Purpose
  const purpose = getFirst(descript?.purpose);
  if (purpose) {
    doc.content.push(createHeadingNode([createTextNode("Purpose")], 2));
    doc.content.push(createParagraphNode([createTextNode(purpose)]));
  }

  // Keywords
  const keywords = getFirst(idinfo?.keywords);
  const theme = getFirst(keywords?.theme);
  const themeKeywords = theme?.themekey.filter(Boolean).join(", ");
  if (themeKeywords) {
    doc.content.push(createHeadingNode([createTextNode("Keywords")], 2));
    doc.content.push(createParagraphNode([createTextNode(themeKeywords)]));
  }

  // Use Constraints
  const useConstraints = getFirst(idinfo?.useconst);
  if (useConstraints) {
    doc.content.push(createHeadingNode([createTextNode("Use Constraints")], 2));
    doc.content.push(
      createParagraphNode([
        createTextNode(useConstraints.split("Downloaded data filename:")[0]),
      ])
    );
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
      const definition = getFirst(attr?.attrdef);

      let domain = "  ";
      const attrdomv = getFirst(attr?.attrdomv);
      if (attrdomv?.udom) {
        domain = getFirst(attrdomv?.udom);
      } else if (attrdomv?.rdom) {
        const rdommin = getFirst(attrdomv?.rdom?.rdommin);
        const rdommax = getFirst(attrdomv?.rdom?.rdommax);
        if (rdommin && rdommax) {
          domain = `${rdommin} to ${rdommax}`;
        } else if (rdommin || rdommax) {
          domain = `Value: ${rdommin || rdommax}`;
        }
      }

      const dataRow = createTableRowNode([
        createTableCellNode([createTextNode(label)]),
        createTableCellNode([createTextNode(definition || "  ")]),
        createTableCellNode([createTextNode(domain)]),
      ]);
      tableRows.push(dataRow);
    });

    const tableNode = createTableNode(tableRows);
    doc.content.push(tableNode);
  }

  // Contact Information
  const metainfo = getFirst(metadata?.metadata?.metainfo);
  const metc = getFirst(metainfo?.metc);
  const cntinfo = getFirst(metc?.cntinfo);
  const cntorgp = getFirst(cntinfo?.cntorgp);
  const contactOrg = getFirst(cntorgp?.cntorg);
  const contactPerson = getFirst(cntinfo?.cntper);
  const contactPhone = getFirst(cntinfo?.cntvoice);
  const contactEmail = getFirst(cntinfo?.cntemail);
  const cntaddr = getFirst(cntinfo?.cntaddr);
  const contactAddress = getFirst(cntaddr?.address);

  if (
    contactOrg ||
    contactPerson ||
    contactPhone ||
    contactEmail ||
    contactAddress
  ) {
    const contactInfoContent = [];
    doc.content.push(
      createHeadingNode([createTextNode("Contact Information")], 2)
    );
    if (contactOrg)
      contactInfoContent.push(
        createListItemNode([createTextNode(`Organization: ${contactOrg}`)])
      );
    if (contactPerson)
      contactInfoContent.push(
        createListItemNode([createTextNode(`Contact Person: ${contactPerson}`)])
      );
    if (contactPhone)
      contactInfoContent.push(
        createListItemNode([createTextNode(`Phone: ${contactPhone}`)])
      );
    if (contactEmail)
      contactInfoContent.push(
        createListItemNode([createTextNode(`Email: ${contactEmail}`)])
      );
    if (contactAddress)
      contactInfoContent.push(
        createListItemNode([createTextNode(`Address: ${contactAddress}`)])
      );
    doc.content.push(createBulletListNode(contactInfoContent));
  }

  const attribution = getAttribution(metadata);

  return {
    title,
    doc,
    attribution,
  };
}

export function getAttribution(metadata: any): string {
  const getFirst = (value: any) =>
    Array.isArray(value) && value.length > 0 ? value[0] : "";

  // Try to retrieve the organization from the citation info
  const idinfo = getFirst(metadata?.metadata?.idinfo);
  const citation = getFirst(idinfo?.citation);
  const citeinfo = getFirst(citation?.citeinfo);
  const organization = getFirst(citeinfo?.origin);
  if (organization) {
    return organization;
  }

  // Fallback to contact organization if citation doesn't have origin
  const metainfo = getFirst(metadata?.metadata?.metainfo);
  const metc = getFirst(metainfo?.metc);
  const cntinfo = getFirst(metc?.cntinfo);
  const cntorgp = getFirst(cntinfo?.cntorgp);
  const contactOrg = getFirst(cntorgp?.cntorg);
  return contactOrg || "Unknown attribution";
}
