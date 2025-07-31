import { SetStateAction } from "react";
import { ReportCardType, ReportCardConfiguration } from "./cards/cards";

export type ReportCardConfigUpdateCallback = (
  update:
    | ReportCardConfiguration<any>
    | ((
        prevState: ReportCardConfiguration<any>
      ) => ReportCardConfiguration<any>)
) => void;

export type ReportCardComponent<T> = React.ComponentType<{
  config: ReportCardConfiguration<T>;
  dragHandleProps?: any;
  cardId?: number;
  onUpdate?: ReportCardConfigUpdateCallback;
}>;

export type ReportCardAdminComponent<T> = React.ComponentType<{
  config: ReportCardConfiguration<T>;
  onUpdate: ReportCardConfigUpdateCallback;
}>;

export type ReportCardPickerComponent = React.ComponentType<{
  type: ReportCardType;
  title: string;
  description?: string;
  icon?: React.ComponentType;
  onClick: () => void;
}>;

export interface ReportCardRegistration<T> {
  type: ReportCardType;
  title: string;
  superusersOnly?: boolean;

  // User-facing component (always loaded)
  component: ReportCardComponent<T>;

  // Admin components (lazy loaded)
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;
  pickerSettings: ReportCardConfiguration<T>;

  // Default settings for new cards of this type
  defaultSettings: T;

  // Validation and export helpers (similar to form elements)
  validateSettings?: (settings: T) => string[] | null;
  getExportData?: (settings: T, data: any) => any;
}

export const registeredCards: Map<
  ReportCardType,
  ReportCardRegistration<any>
> = new Map();

export interface RegisterReportCardConfig<T> {
  type: ReportCardType;
  title: string;
  component: ReportCardComponent<T>;
  defaultSettings: T;
  superusersOnly?: boolean;
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;
  validateSettings?: (settings: T) => string[] | null;
  getExportData?: (settings: T, data: any) => any;
  pickerSettings: ReportCardConfiguration<T>;
}

export function registerReportCardType<T>(config: RegisterReportCardConfig<T>) {
  registeredCards.set(config.type, {
    type: config.type,
    title: config.title,
    superusersOnly: config.superusersOnly,
    component: config.component,
    adminComponent: config.adminComponent,
    defaultSettings: config.defaultSettings,
    validateSettings: config.validateSettings,
    getExportData: config.getExportData,
    pickerSettings: config.pickerSettings,
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

export function getCardPickerComponent(
  type: ReportCardType
): React.ReactNode | null {
  const registration = registeredCards.get(type);
  if (!registration) return null;
  const Component = getCardComponent(type);
  if (!Component) return null;
  return <Component config={{ ...registration.pickerSettings, type }} />;
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

  return Array.from(registeredCards.values())
    .filter((card) => !card.superusersOnly || isSuperuser)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((card) => card.type);
}
