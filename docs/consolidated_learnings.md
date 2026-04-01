## Web Development & Architecture

**Pattern: Deno Environment Variables and Feature Flags**

- Instead of relying on generic environment variables like `NODE_ENV` or
  `DENO_ENV`, use feature-specific flags.
- For example, use `ENABLE_AUTH=false` to bypass authentication locally, or
  `COOKIE_SECURE=false` for local development without HTTPS.
- Access these variables natively using `Deno.env.get('VAR_NAME')` rather than
  `process.env` or `import.meta.env`.
- _Rationale:_ This provides finer-grained control over application behavior
  across different environments and leverages Deno's native APIs.

**Best Practice: Clear Communication of Implementation Limitations**

- When unable to implement a complete solution (e.g., due to missing backend
  capabilities or scope constraints), clearly communicate these limitations to
  the user.
- Provide guidance or steps for the user to implement the remaining parts
  themselves.
- _Rationale:_ Manages expectations and empowers the user to complete the
  solution.
