require("dotenv").config();
module.exports = {
  databaseOwner: "postgres",
  rootConnectionString: "postgres://postgres:password@localhost:54321/postgres",
  connectionString: process.env.ADMIN_DATABASE_URL,
  shadowConnectionString:
    "postgres://postgres:password@localhost:54321/seasketch_shadow",
  pgSettings: {
    search_path: "private,public",
  },
  afterAllMigrations: [
    {
      _: "command",
      shadow: true,
      command:
        'echo \'after\' && if [ "$IN_TESTS" != "1" ]; then npm run db:schema && node dist/src/createCleanGraphqlSchema.js; fi',
    },
  ],
  afterReset: ["afterReset.sql"],
};
