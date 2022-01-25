# About

The SeaSketch Next client application is built using [create-react-app](https://create-react-app.dev/). It's architecture is typical of a single-page-app and uses the [SeaSketch Next GraphQL API](https://github.com/seasketch/next/tree/master/packages/api) for data persistence.

[![Client](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/detailed/jo53du/master&style=flat&logo=cypress)](https://dashboard.cypress.io/projects/jo53du/runs)

## Installing

```sh
git clone https://github.com/seasketch/next.git
cd next/packages/client
npm install
cp .env.template .env
npm start
```

## SSL

If you need to run locally using SSL, you'll need to setup the [environment properly for both the api server and the client](https://github.com/seasketch/next/wiki/Setting-up-SSL-on-localhost).

## i18n

Localization is managed using [i18next](https://react.i18next.com/). Wrap _all_ strings in appropriate tags so they can be translated into multiple languages. ESLint rules will flag missing tags.

We're using a [public POEditor project](https://poeditor.com/join/project?hash=juloLqMZDP) to manage translations. Local npm scripts exist to publish new terms to this project and extract translations into the `client/src/lang` directory. Run `npm run translation:sync` to perform these operations. It is important to do this regularly. The CI system will build a newly updated clients, but will only include new translations if this step is performed and changes are checked in.

### i18n namespaces

Terms are organized into [namespaces](https://react.i18next.com/guides/multiple-translation-files), each with their own translation file. Currently only a subset of namespaces are published to the POEditor project to be translated. Originally SeaSketch Next is being launched to support ocean use surveys so we are only translating the public side of the survey functionality.

To add new namespaces as new features are launched, edit `client/src/lang/namespaces.json`.

### Adding new languages

To add new supported languages, add required metadata to `client/src/lang/supported.ts`. You will also need to add a matching entry to the POEditor project using their GUI.

## Querying the GraphQL API

The client will connect to the GraphQL endpoint specified by the `REACT_APP_GRAPHQL_ENDPOINT` environment variable. An [Apollo Client](https://www.apollographql.com/docs/react/) context is provided to all React components. Using Visual Studio Code and the [Apollo GraphQL plugin](https://marketplace.visualstudio.com/items?itemName=apollographql.vscode-apollo), you should see IntelliSense hints when authoring queries based on the generated GraphQL schema found in `packages/api/generated-schema.gql`.

While authoring queries and handling data you should run the `graphql:codegen` npm script. This script will watch for changes in React components and generate types for GraphQL queries, as well as custom hooks. These can be found in `src/generated/graphql.ts`. Beware they can be a bit slow to be picked up by the TypeScript server in VSCode, so you may want to visit the graphql.ts file manually. Queries should be placed in `src/queries/*.graphql` (not co-located in components).

## Component library

SeaSketch Next doesn't use a pre-made component library. Instead, common components should go in `src/components/*.tsx`. Reusable UI elements currently include Switch, Button, and TextInput components. Be sure to document components thouroughly using jsdoc conventions and provide examples using storybook.

The [Tailwind CSS framework](https://tailwindcss.com) is included and used for styling custom components. Use [Tailwind UI](https://tailwindui.com/components) when developing the user interface to develop a consistent look and feel.

## Other tech notes

- Use [react-router-dom](https://reactrouter.com/web/guides/quick-start) to manage routes
- Use [React.lazy](https://reactjs.org/docs/code-splitting.html#reactlazy) to create code-splitting boundaries where necessary.

## Deploying changes

Start an [automated deployment](https://github.com/seasketch/next#deployments) using a pull request.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run extract-translations`

Extract i18n identifiers and place in `./extractedTranslations`.

### `npm run graphql:codegen`

Generates types from `gql` template tags and stores them in `src/generated/graphql.ts`.

### `npm run storybook`

Starts a storybook server on localhost:8080 where documentation and examples for reusable components can be referenced.
