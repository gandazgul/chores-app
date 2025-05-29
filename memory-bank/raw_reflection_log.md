---
Date: 2025-05-28
TaskRef: "Replace Firebase with Supabase for Chores App"

Learnings:
- Supabase schema design:
  - `chores` table with `id UUID PRIMARY KEY`, `user_id UUID FK to auth.users`, `title TEXT`, `description TEXT`, `priority INTEGER`, `done BOOLEAN`, `due_date TIMESTAMPTZ`, `remind_until_done BOOLEAN`, `recurrence JSONB`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
  - `JSONB` is suitable for storing complex, variable recurrence rule objects (like rSchedule options).
  - Auto-updating `updated_at` column using a PostgreSQL trigger function:
    ```sql
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER update_chores_updated_at
    BEFORE UPDATE ON chores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    ```
- Data Migration (Firestore to Supabase):
  - Firestore Timestamps need conversion to ISO 8601 strings for `TIMESTAMPTZ` columns or direct `Date` objects for Supabase client.
  - Recurrence objects (maps in Firestore) translate well to `JSONB` in Supabase. Ensure date strings within JSON are ISO 8601.
  - `user_id` for direct SQL `INSERT`s into a table with a `NOT NULL` foreign key to `auth.users` must be a valid, existing user ID from the `auth.users` table. Placeholder UUIDs will fail FK constraints.
- Supabase Auth (JavaScript client `@supabase/supabase-js`):
  - Initialization: `createClient(supabaseUrl, supabaseAnonKey)`.
  - Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - Get current session: `supabase.auth.getSession()`. Returns `{ data: { session }, error }`.
  - Auth state listener: `supabase.auth.onAuthStateChange((event, session) => { ... })`. `session.user` contains user details.
  - Sign out: `supabase.auth.signOut()`.
  - User profile picture: `user.user_metadata?.avatar_url` or `user.user_metadata?.picture` (differs from Firebase's `user.photoURL`).
- Supabase Database Client (JavaScript):
  - Fetching data: `supabase.from('table_name').select('*').eq('column', 'value')`.
  - Inserting data: `supabase.from('table_name').insert([{ column: 'value' }]).select()`. `.select()` returns the inserted row(s).
  - Updating data: `supabase.from('table_name').update({ column: 'new_value' }).eq('id_column', 'id_value')`.
  - Deleting data: `supabase.from('table_name').delete().eq('id_column', 'id_value')`.
- SolidJS:
  - Passing user state (e.g., `currentUser` signal) as props to child components.
  - Using `onMount` for initial data fetching and setting up listeners.
  - Using `createEffect` for reactive data fetching based on user state.
  - `props.currentUser()` to access signal value passed as prop.

Difficulties:
- Initial oversight on `user_id` for SQL `INSERT` statements: A placeholder UUID would violate foreign key constraints if it doesn't exist in `auth.users`. Corrected by requiring a valid existing `user_id`.
- Ensuring `currentUser` prop was consistently passed to all components needing it (e.g., `Chores.jsx` from `App.jsx`).

Successes:
- Successfully planned and executed the migration from Firebase to Supabase.
- Designed a functional Supabase schema for the `chores` table.
- Correctly refactored authentication and data management logic across multiple SolidJS components.
- Handled data conversion between application representation and Supabase storage (dates, recurrence objects).

Improvements_Identified_For_Consolidation:
- General pattern: When migrating DBs with FK constraints, ensure sample data inserts use valid FKs or temporarily disable constraints if appropriate (though less ideal for `user_id`).
- Supabase: Common user data fields (like `user.id`, `user.user_metadata`).
- Supabase: Standard CRUD operations syntax.
---
