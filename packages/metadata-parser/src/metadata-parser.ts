import { getAttribution, iso19139ToMarkdown } from "./iso19139";
import {
  esriToMarkdown,
  getAttribution as getEsriAttribution,
} from "./esriToMarkdown";
// @ts-ignore
import { parseStringPromise } from "xml2js";

export enum MetadataType {
  ISO19139,
  ESRI,
}

export interface Contact {
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

export async function metadataToMarkdown(xmlString: string) {
  try {
    const data = await parseStringPromise(xmlString);
    let markdown = "";
    let attribution: string | null = null;
    let type = MetadataType.ISO19139;
    if (data["gmd:MD_Metadata"]) {
      markdown = iso19139ToMarkdown(data);
      attribution = getAttribution(data);
    } else if (data["metadata"]) {
      markdown = esriToMarkdown(data);
      attribution = getEsriAttribution(data);
    } else {
      return null;
    }
    return {
      type,
      markdown,
      attribution,
    };
  } catch (error: any) {
    throw new Error(`Error processing XML: ${error.message}`);
  }
}
