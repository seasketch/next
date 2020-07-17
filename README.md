# SeaSketch Next

This project consists of multiple packages in a monorepo configuration.

### [packages/api](./packages/api)

This is the core server package. It include a GraphQL API server based on Postgraphile, and all database migrations. It also includes an exported node api (`@seasketch/api`) that can be used by other services to access and manipulate application data.

![packages/api](https://github.com/seasketch/next/workflows/packages/api/badge.svg)
