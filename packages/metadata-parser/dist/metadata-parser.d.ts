export declare enum MetadataType {
    ISO19139 = 0,
    FGDC = 1
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
export declare function metadataToProseMirror(xmlString: string): Promise<{
    title: any;
    doc: any;
    attribution: string | null;
} | null>;
