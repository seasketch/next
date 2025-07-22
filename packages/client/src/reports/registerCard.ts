import { ReportCardType, ReportCardConfiguration } from "./cards";
import { lazy, ComponentType } from "react";

export type ReportCardComponent<T extends { [key: string]: any }> =
  React.ComponentType<{
    config: ReportCardConfiguration<T>;
  }>;

export type ReportCardAdminComponent<T extends { [key: string]: any }> =
  React.ComponentType<{
    config: ReportCardConfiguration<T>;
    onUpdate: (config: ReportCardConfiguration<T>) => void;
  }>;

export type ReportCardPickerComponent<T extends { [key: string]: any }> =
  React.ComponentType<{
    type: ReportCardType;
    title: string;
    description?: string;
    icon?: React.ComponentType;
    onClick: () => void;
  }>;

export interface ReportCardRegistration<T extends { [key: string]: any }> {
  type: ReportCardType;
  title: string;
  superusersOnly?: boolean;

  // User-facing component (always loaded)
  component: ReportCardComponent<T>;

  // Admin components (lazy loaded)
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;
  pickerComponent?: React.LazyExoticComponent<ReportCardPickerComponent<T>>;

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

export interface RegisterReportCardConfig<T extends { [key: string]: any }> {
  type: ReportCardType;
  title: string;
  component: ReportCardComponent<T>;
  defaultSettings: T;
  superusersOnly?: boolean;
  adminComponent?: React.LazyExoticComponent<ReportCardAdminComponent<T>>;
  pickerComponent?: React.LazyExoticComponent<ReportCardPickerComponent<T>>;
  validateSettings?: (settings: T) => string[] | null;
  getExportData?: (settings: T, data: any) => any;
}

export function registerReportCardType<T extends { [key: string]: any }>(
  config: RegisterReportCardConfig<T>
) {
  console.log("registering card type", config.type);
  registeredCards.set(config.type, {
    type: config.type,
    title: config.title,
    superusersOnly: config.superusersOnly,
    component: config.component,
    adminComponent: config.adminComponent,
    pickerComponent: config.pickerComponent,
    defaultSettings: config.defaultSettings,
    validateSettings: config.validateSettings,
    getExportData: config.getExportData,
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
): React.LazyExoticComponent<ReportCardPickerComponent<any>> | null {
  const registration = registeredCards.get(type);
  return registration?.pickerComponent || null;
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
