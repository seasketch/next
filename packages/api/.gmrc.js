module.exports = {
  databaseOwner: "postgres",
  rootConnectionString: "postgres://postgres:password@localhost:54321/postgres",
  connectionString:
    process.env.DATABASE_URL && process.env.DATABASE_URL.length
      ? process.env.DATABASE_URL
      : "postgres://postgres:password@localhost:54321/seasketch",
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
        'echo \'after\' && if [ "$IN_TESTS" != "1" ]; then npm run db:schema && npm run services:rotatekeys; fi',
    },
  ],
};
