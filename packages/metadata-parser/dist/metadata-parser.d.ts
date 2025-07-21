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
export declare function metadataToProseMirror(xmlString: string): Promise<import("@seasketch/geostats-types").GeostatsMetadata | null>;
//# sourceMappingURL=metadata-parser.d.ts.map