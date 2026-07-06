export declare function putObject(filepath: string, remote: string): Promise<void>;
export declare function getObject(filepath: string, remote: string): Promise<void>;
export declare function getStagingObject(filepath: string, objectKey: string): Promise<void>;
export declare function buildR2Remote(slug: string, uploadId: string, filename: string): {
    remote: string;
    key: string;
    bucket: string;
};
