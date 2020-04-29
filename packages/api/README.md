# SeaSketch Next API Server

GraphQL server implemented using [postgraphile](https://www.graphile.org/postgraphile/).

## Getting started

Before running, make sure you have [started the database](https://github.com/seasketch/next/tree/master/packages/db).

```bash
npm install
npm run watch
# running on localhost:3857/graphiql
```

Be aware that scripts will run `dist/index.js`. In order to view changes from typescript files you must compile them locally. This is easily accomplished if using VS Code by choosing `Terminal -> Run Build Task ⇧⌘B`