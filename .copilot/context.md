# SeaSketch Next – Copilot Context Guide

## 🧱 Project Architecture

- **Monorepo Structure**: Managed with Lerna, containing multiple packages:
  - `packages/api`: GraphQL API server using PostGraphile.
  - `packages/client`: React SPA built with Create React App.
  - `packages/infra`: AWS CDK app defining production infrastructure.
  - There are several other packages to support different "tasks" using AWS lambda and cloudflare workers, as well as extra modules used by one or more of the main api and client projects.

## 🖥️ Development Environment

- **TypeScript**: Primary language across the codebase.
- **React**: Functional components with Hooks.
- **GraphQL**: All data is sent to/from the client using GraphQL
- **Styling**: Tailwind CSS

## 🧰 Coding Conventions

- **Naming**:
  - Variables and functions: `camelCase`.
  - Classes and components: `PascalCase`.
- **Imports**:
  - Use absolute imports where possible.
- **Components**:
  - Prefer functional components with Hooks.
  - Use default exports, prefering a single component per file. If there are groups of related components, create a directory to organize them.
  - Where possible, reuse components in `packages/client/src/components/`. Particularly the modal component. When 3rd party components are needed, prefer Radix UI.
  - Icons - Use Radix icons where available, and fall back to heroicons. Both are already installed.
- **Code Style**
  - Follow the conventions defined in `packages/client/.eslintrc.js`, and `.vscode/settings.json`.
- **i18n**
  - Client code eslint rules disallow untranslated strings. Readable content should be wrapped in a Trans component with an appropriate namespace, or use
    a component-level translate function. Trans tags are better for string content mixed with html tags. For quoted strings that don't need to be translated, use a special comment to disable the rule for that line (// eslint-disable-next-line i18next/no-literal-string)

## 📄 Example: Creating a New React Component (including i18n)

```tsx
// packages/client/src/components/MyComponent.tsx
import React from "react";
import { Trans, useTranslation } from "react-i18next";

interface MyComponentProps {
  title: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  const { t } = useTranslation("homepage");
  return (
    <div>
      <h1>{title}</h1>
      <button>{t("Go Back")}</button>
      <p>
        <Trans ns="homepage">
          Visit the <a href="https://www.seasketch.org">SeaSketch Homepage</a>
        </Trans>
      </p>
    </div>
  );
};
```

## GraphQL Queries and Mutations

- The capabilities of the GraphQL API are defined in `packages/api/generated-schema.gql`.
- When a new query or mutation is necessary, create it in `packages/api/migrations/current.sql`, following the guidance of the PostGraphile documentation at https://www.graphile.org/postgraphile/introduction/. Never create a migration file in `packages/api/migrations/committed` directly. If a mutation or query is particularly complex, it can be implemented as a plugin under `packages/api/src/plugins`.
