  * start script:
    * npx postgraphile -c postgres://postgres:password@localhost:54320/seasketch --watch --append-plugins @graphile-contrib/pg-simplify-inflector --default-role anon
  * Next steps
    * x Get basic understanding of Auth0 token claims that are available for validating API requests
      * x seems like for APIs, only sub(user id) and scope are available
      * x might be possible to cram projectid or subdomain into scope
      * x regardless, seems like there is _some_ place this could be done
    * x create basic api app
      * x set expectations for current_setting
      * x set default plugins, database connection, and such
    * write unit tests for project access control
    * Create basic user accounts schema and RLS
    * filter out unnecessary mutations, queries, etc