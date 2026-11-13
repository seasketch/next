import { CatalogOutput } from "./columns";

export type CatalogUser = {
  id: number;
  superuser: boolean;
  emailVerified: boolean;
};

export type RawTocItem = {
  stableId: string;
  parentStableId: string | null;
  title: string;
  isFolder: boolean;
  sortIndex: number;
  accessType: string | null;
  accessGroupNames: string[];
  sourceType: string | null;
  sublayerType: string | null;
  sublayer: string | null;
  sourceUrl: string | null;
  sourceLayer: string | null;
  createdAt: Date | string | null;
  authorName: string | null;
  authorEmail: string | null;
  geostats: unknown;
  attribution: string | null;
  enableDownload: boolean;
  hasMetadata: boolean;
  uploadedSourceFilename: string | null;
  outputs: CatalogOutput[];
};

export type LayerResourceRecord = {
  stableId: string;
  path: string;
  metadata: unknown;
  sublayer: string | null;
  style: unknown;
  geostats: unknown;
  sourceType: string | null;
  sourceUrl: string | null;
};

export type AccessListRecord = {
  id: number;
  type: string;
};

export interface LayerCatalogStore {
  projectBySlug(slug: string): Promise<{ id: number } | null>;
  draftItems(projectId: number): Promise<RawTocItem[]>;
  layerResource(
    projectId: number,
    stableId: string,
    isDraft: boolean
  ): Promise<LayerResourceRecord | null>;
  accessLists(
    projectId: number,
    isDraft: boolean,
    path: string
  ): Promise<AccessListRecord[]>;
  isProjectAdmin(projectId: number, userId: number): Promise<boolean>;
  memberAclIds(aclIds: number[], userId: number): Promise<number[]>;
}
