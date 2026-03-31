## Web Development & Architecture

**Pattern: Deno Environment Variables and Feature Flags**

- Instead of relying on generic environment variables like `NODE_ENV` or `DENO_ENV`, use feature-specific flags.
- For example, use `ENABLE_AUTH=false` to bypass authentication locally, or `COOKIE_SECURE=false` for local development without HTTPS.
- Access these variables natively using `Deno.env.get('VAR_NAME')` rather than `process.env` or `import.meta.env`.
- _Rationale:_ This provides finer-grained control over application behavior across different environments and leverages Deno's native APIs.

**Best Practice: Clear Communication of Implementation Limitations**

- When unable to implement a complete solution (e.g., due to missing backend
  capabilities or scope constraints), clearly communicate these limitations to
  the user.
- Provide guidance or steps for the user to implement the remaining parts
  themselves.
- _Rationale:_ Manages expectations and empowers the user to complete the
  solution.

## Database & Knex.js

**Pattern: Knex.js Migrations**

- **Create a migration:** `yarn knex migrate:make <migration_name>`
- **Run migrations:** `yarn knex migrate:latest`
- **Rollback a migration:** `yarn knex migrate:rollback`
- **Migration Structure:**
  - `up()`: Defines the schema changes to be applied.
  - `down()`: Defines how to revert the changes made in `up()`.
- _Rationale:_ Provides a version-controlled way to manage database schema
  changes.

**Pattern: Knex.js Querying**

- **Configuration:** `knexfile.js` contains the database connection details for
  different environments.
- **Query Builder:** Use the Knex.js query builder to interact with the database
  in a structured and secure way.
- _Rationale:_ Abstracts away raw SQL, reducing the risk of SQL injection and
  making database interactions more readable and maintainable.
