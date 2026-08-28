export type CkanFieldType = "markdown" | "text" | "date" | "url" | "email" | "list" | "keyvalue" | "repeating";
export type CkanFieldGroup = "Overview" | "Dates" | "Attribution" | "Other" | "Resources";
export type CkanFieldSource = "core" | "schema" | "extra";
export interface CkanMetadataField {
    id: string;
    label: string;
    value: unknown;
    displayValue?: string | string[];
    type: CkanFieldType;
    group?: CkanFieldGroup;
    source: CkanFieldSource;
    recommended: boolean;
    technical: boolean;
}
export interface CkanDisplayFieldConfig {
    id: string;
    included: boolean;
    label?: string;
}
export interface CkanDisplayConfig {
    fields?: CkanDisplayFieldConfig[];
    includeResources?: boolean;
}
export interface CkanSchemaChoice {
    value: string;
    label: string | Record<string, string>;
    replaces?: string[];
}
export interface CkanSchemaField {
    field_name: string;
    label?: string | Record<string, unknown>;
    preset?: string;
    choices?: CkanSchemaChoice[];
    repeating_subfields?: CkanSchemaField[];
}
export interface CkanSchema {
    dataset_type?: string;
    form_languages?: string[];
    alternate_languages?: Record<string, string[]>;
    sidebar_show_fields?: string[];
    dataset_fields?: CkanSchemaField[];
    resource_fields?: CkanSchemaField[];
}
export interface CkanResource {
    id?: string;
    name?: string;
    name_translated?: Record<string, string>;
    url?: string;
    format?: string;
    description?: string;
    description_translated?: Record<string, string>;
}
export interface CkanPackage {
    id?: string;
    name?: string;
    title?: string;
    notes?: string;
    type?: string;
    url?: string;
    extras?: Array<{
        key?: string;
        value?: unknown;
    }>;
    resources?: CkanResource[];
    organization?: {
        title?: string;
        name?: string;
        id?: string;
    };
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map