---
Date: 2025-06-04
TaskRef: "Fix SyntaxError in Supabase Edge Function and guide on local Deno testing"

Learnings:
- The `Rule` class from the `rschedule` library is imported from `@rschedule/core`, not `@rschedule/standard-date-adapter`. The specific import path for esm.sh is `https://esm.sh/@rschedule/core@1.5.0`.
- Supabase Edge Functions run in a Deno environment. TypeScript errors in editors like VS Code (e.g., "Cannot find name 'Deno'", "Cannot find module 'https://deno.land/...'") are common if the editor isn't configured for Deno (e.g., via a `deno.json` or `deno.jsonc` file). These are often editor-specific type-checking issues and may not indicate a runtime error in Deno.

Difficulties:
- The initial `SyntaxError` was due to an incorrect import path for the `Rule` class.
- After correcting the import, new TypeScript errors appeared in the VS Code editor related to Deno-specific types and modules. This is a common DX issue when Deno isn't fully configured in the IDE.

Successes:
- Correctly diagnosed the `SyntaxError` as an import issue.
- Successfully modified the import statement in `supabase/functions/send-chore-notifications/index.ts` using the `replace_in_file` tool.
- Provided a plan for local Deno testing of Supabase Edge Functions.

Improvements_Identified_For_Consolidation:
- General pattern: When a module "does not provide an export named X", especially with libraries having multiple sub-packages (e.g., `rschedule`), double-check the correct source package for the export. Consulting documentation or inspecting the `esm.sh` entry point for the suspected packages can confirm this.
- Deno/Supabase Functions: For improved local development experience with TypeScript and Deno in VS Code, consider adding a `deno.json` or `deno.jsonc` file at the root of the functions directory (or project root) to configure the TypeScript language server (e.g., by setting `compilerOptions.lib` to include `"deno.ns"`). This helps resolve editor-side type errors.
