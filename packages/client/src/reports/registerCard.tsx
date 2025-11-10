import { ReportCardType, ReportCardConfiguration } from "./cards/cards";
import { MetricType } from "overlay-engine";
import { ReactElement, FunctionComponent } from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  DataSourceTypes,
  DataUploadOutputType,
  OverlaySourceDetailsFragment,
  SketchClassDetailsFragment,
} from "../generated/graphql";

export type ReportCardConfigUpdateCallback = (
  update:
    | ReportCardConfiguration<any>
    | ((
        prevState: ReportCardConfiguration<any>
      ) => ReportCardConfiguration<any>)
) => void;

export type ReportCardComponent<T> = React.ComponentType<{
  config: ReportCardConfiguration<T>;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: string[];
  dragHandleProps?: any;
  cardId?: number;
  onUpdate?: ReportCardConfigUpdateCallback;
}>;

export type ReportCardAdminComponent<T> = React.ComponentType<{
  config: ReportCardConfiguration<T>;
  onUpdate: ReportCardConfigUpdateCallback;
}>;

export interface ReportCardRegistration<T> {
  type: ReportCardType;
  superusersOnly?: boolean;

  // User-facing component (always loaded)
  component: ReportCardComponent<T>;

  // Admin components (lazy loaded)
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;

  // Default settings for new cards of this type
  defaultSettings: T;

  // Default body content for new cards
  defaultBody: any;

  // Display properties for the admin interface
  label: ReactElement;
  description: ReactElement;
  icon: FunctionComponent<{
    componentSettings: T;
    sketchClass?: SketchClassDetailsFragment | undefined | null;
  }>;

  // Validation and export helpers (similar to form elements)
  validateSettings?: (settings: T) => string[] | null;
  getExportData?: (settings: T, data: any) => any;
  requiredMetrics?: (componentSettings: T) => MetricType[];
  order?: number;
  supportedReportingLayerTypes: DataSourceTypes[];
  minimumReportingLayerCount: number;
  maximumReportingLayerCount?: number;
}

export const registeredCards: Map<
  ReportCardType,
  ReportCardRegistration<any>
> = new Map();

export interface RegisterReportCardConfig<T> {
  type: ReportCardType;
  component: ReportCardComponent<T>;
  defaultSettings: T;
  defaultBody: any;
  superusersOnly?: boolean;
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;
  validateSettings?: (settings: T) => string[] | null;
  getExportData?: (settings: T, data: any) => any;
  label: ReactElement;
  description: ReactElement;
  icon: FunctionComponent<{
    componentSettings: T;
    sketchClass?: SketchClassDetailsFragment | undefined | null;
  }>;
  order?: number;
  supportedReportingLayerTypes?: DataSourceTypes[];
  minimumReportingLayerCount?: number;
  maximumReportingLayerCount?: number;
}

export function registerReportCardType<T>(config: RegisterReportCardConfig<T>) {
  registeredCards.set(config.type, {
    type: config.type,
    superusersOnly: config.superusersOnly,
    component: config.component,
    adminComponent: config.adminComponent,
    defaultSettings: config.defaultSettings,
    defaultBody: config.defaultBody,
    validateSettings: config.validateSettings,
    getExportData: config.getExportData,
    label: config.label,
    description: config.description,
    icon: config.icon,
    order: config.order,
    supportedReportingLayerTypes: config.supportedReportingLayerTypes || [],
    minimumReportingLayerCount: config.minimumReportingLayerCount || 0,
    maximumReportingLayerCount: config.maximumReportingLayerCount,
  });
}

// Lazy loading helpers
export function getCardComponent(
  type: ReportCardType
): ReportCardComponent<any> | null {
  const registration = registeredCards.get(type);
  return registration?.component || null;
}

export function getCardAdminComponent(
  type: ReportCardType
): React.LazyExoticComponent<ReportCardAdminComponent<any>> | null {
  const registration = registeredCards.get(type);
  return registration?.adminComponent || null;
}

export function getCardRegistration(
  type: ReportCardType
): ReportCardRegistration<any> | null {
  return registeredCards.get(type) || null;
}

/**
 * Returns a sorted list of all available card types
 * @param options - Optional configuration for filtering
 * @param options.superuser - If true, includes superuser-only card types
 * @returns Array of card types sorted by their registration title
 */
export function getAvailableCardTypes(options?: {
  superuser?: boolean;
}): ReportCardType[] {
  const isSuperuser = options?.superuser || false;

  // Get cards and sort by order if specified
  const cards = Array.from(registeredCards.values()).filter(
    (card) => !card.superusersOnly || isSuperuser
  );

  // Sort by order property if available, otherwise preserve insertion order
  cards.sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  return cards.map((card) => card.type);
}
