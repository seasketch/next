import { ChangeLogFieldGroup } from "../../../generated/graphql";
import FolderAclFieldGroupListItem from "./FolderAclFieldGroupListItem";
import FolderCreatedFieldGroupListItem from "./FolderCreatedFieldGroupListItem";
import FolderDeletedFieldGroupListItem from "./FolderDeletedFieldGroupListItem";
import FolderTitleFieldGroupListItem from "./FolderTitleFieldGroupListItem";
import FolderTypeFieldGroupListItem from "./FolderTypeFieldGroupListItem";
import GenericFieldGroupListItem from "./GenericFieldGroupListItem";
import LayerAclFieldGroupListItem from "./LayerAclFieldGroupListItem";
import LayerAttributionFieldGroupListItem from "./LayerAttributionFieldGroupListItem";
import LayerCartographyFieldGroupListItem from "./LayerCartographyFieldGroupListItem";
import LayerDeletedFieldGroupListItem from "./LayerDeletedFieldGroupListItem";
import LayerDownloadableFieldGroupListItem from "./LayerDownloadableFieldGroupListItem";
import LayerInteractivityFieldGroupListItem from "./LayerInteractivityFieldGroupListItem";
import LayerMetadataFieldGroupListItem from "./LayerMetadataFieldGroupListItem";
import LayerParentChangedFieldGroupListItem from "./LayerParentChangedFieldGroupListItem";
import LayerTitleFieldGroupListItem from "./LayerTitleFieldGroupListItem";
import LayerUploadedFieldGroupListItem from "./LayerUploadedFieldGroupListItem";
import LayersPublishedFieldGroupListItem from "./LayersPublishedFieldGroupListItem";
import LayersZOrderChangeFieldGroupListItem from "./LayersZOrderChangeFieldGroupListItem";
import ResolvableLayerCommentFieldGroupListItem from "./ResolvableLayerCommentFieldGroupListItem";
import DataTableCreatedFieldGroupListItem from "./DataTableCreatedFieldGroupListItem";
import DataTableDeletedFieldGroupListItem from "./DataTableDeletedFieldGroupListItem";
import DataTableRenamedFieldGroupListItem from "./DataTableRenamedFieldGroupListItem";
import DataTableReplacedFieldGroupListItem from "./DataTableReplacedFieldGroupListItem";
import DataTableRollbackFieldGroupListItem from "./DataTableRollbackFieldGroupListItem";

export { GenericFieldGroupListItem };

export const FIELD_GROUP_LIST_ITEM_COMPONENTS: Partial<
  Record<ChangeLogFieldGroup, typeof LayerTitleFieldGroupListItem>
> = {
  [ChangeLogFieldGroup.LayerTitle]: LayerTitleFieldGroupListItem,
  [ChangeLogFieldGroup.FolderTitle]: FolderTitleFieldGroupListItem,
  [ChangeLogFieldGroup.LayerAcl]: LayerAclFieldGroupListItem,
  [ChangeLogFieldGroup.FolderAcl]: FolderAclFieldGroupListItem,
  [ChangeLogFieldGroup.LayerCartography]: LayerCartographyFieldGroupListItem,
  [ChangeLogFieldGroup.LayerMetadata]: LayerMetadataFieldGroupListItem,
  [ChangeLogFieldGroup.LayerAttribution]: LayerAttributionFieldGroupListItem,
  [ChangeLogFieldGroup.LayerDownloadable]: LayerDownloadableFieldGroupListItem,
  [ChangeLogFieldGroup.LayerInteractivity]: LayerInteractivityFieldGroupListItem,
  [ChangeLogFieldGroup.LayerParentChanged]:
    LayerParentChangedFieldGroupListItem,
  [ChangeLogFieldGroup.LayerDeleted]: LayerDeletedFieldGroupListItem,
  [ChangeLogFieldGroup.FolderDeleted]: FolderDeletedFieldGroupListItem,
  [ChangeLogFieldGroup.LayerUploaded]: LayerUploadedFieldGroupListItem,
  [ChangeLogFieldGroup.FolderCreated]: FolderCreatedFieldGroupListItem,
  [ChangeLogFieldGroup.FolderType]: FolderTypeFieldGroupListItem,
  [ChangeLogFieldGroup.LayersPublished]: LayersPublishedFieldGroupListItem,
  [ChangeLogFieldGroup.LayersZOrderChange]: LayersZOrderChangeFieldGroupListItem,
  [ChangeLogFieldGroup.ResolvableLayerCommentsCreated]:
    ResolvableLayerCommentFieldGroupListItem,
  [ChangeLogFieldGroup.ResolvableLayerCommentsResponded]:
    ResolvableLayerCommentFieldGroupListItem,
  [ChangeLogFieldGroup.ResolvableLayerCommentsResolved]:
    ResolvableLayerCommentFieldGroupListItem,
  [ChangeLogFieldGroup.ResolvableLayerCommentsReopened]:
    ResolvableLayerCommentFieldGroupListItem,
  [ChangeLogFieldGroup.DataTableCreated]: DataTableCreatedFieldGroupListItem,
  [ChangeLogFieldGroup.DataTableDeleted]: DataTableDeletedFieldGroupListItem,
  [ChangeLogFieldGroup.DataTableRenamed]: DataTableRenamedFieldGroupListItem,
  [ChangeLogFieldGroup.DataTableReplaced]: DataTableReplacedFieldGroupListItem,
  [ChangeLogFieldGroup.DataTableRollback]: DataTableRollbackFieldGroupListItem,
};
