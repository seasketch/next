// @ts-ignore
import { parseStringPromise } from "xml2js";
import { fgdcToProseMirror } from "./fgdcToProsemirror";
import { iso19139ToProseMirror } from "./iso19139ToProseMirror";

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

export async function metadataToProseMirror(xmlString: string) {
  try {
    const data = await parseStringPromise(xmlString);
    if (data["gmd:MD_Metadata"]) {
      return iso19139ToProseMirror(data);
    } else if (data["metadata"] && data["metadata"]["idinfo"]) {
      return fgdcToProseMirror(data);
    } else {
      return null;
    }
  } catch (error: any) {
    throw new Error(`Error processing XML: ${error.message}`);
  }
}
