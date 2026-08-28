import { ProseMirrorNode } from "./proseMirrorTypes";
import { CkanDisplayConfig, CkanMetadataField } from "./types";
export type { ProseMirrorMark, ProseMirrorNode } from "./proseMirrorTypes";
export declare function applyDisplayConfig(fields: CkanMetadataField[], config?: CkanDisplayConfig | null): CkanMetadataField[];
export interface ToProseMirrorOptions {
    title?: string;
    lang?: string;
    resources?: unknown;
}
export declare function ckanFieldsToProseMirror(fields: CkanMetadataField[], config?: CkanDisplayConfig | null, options?: ToProseMirrorOptions): ProseMirrorNode;
export declare function packageTitle(pkg: Record<string, unknown> | undefined, lang?: string): string | undefined;
//# sourceMappingURL=toProseMirror.d.ts.map