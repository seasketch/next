export declare function putObject(filepath: string, remote: string): Promise<void>;
export declare function getObject(filepath: string, remote: string): Promise<void>;
export declare function getStagingObject(filepath: string, objectKey: string): Promise<void>;
/**
 * Store data tables under the parent layer's hosted UUID so objects classify
 * as `published` in the tiles ACL gateway and inherit the layer's ACL.
 *
 * `projects/{slug}/public/{sourceUuid}/dataTables/{uploadId}/{filename}`
 */
export declare function buildR2Remote(slug: string, sourceUuid: string, uploadId: string, filename: string): {
    remote: string;
    key: string;
    bucket: string;
};
