-- This migration enables Row Level Security (RLS) on the 'chores' table
-- and sets up roles-based access policies to allow for admin users.

-- 1. Create a table to store user roles
CREATE TABLE public.user_roles (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    UNIQUE(user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Stores roles for each user, e.g., admin.';

-- 2. Enable RLS on the chores table
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

-- 3. Create a helper function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RLS policies for the 'chores' table

-- Policy for SELECT operations
CREATE POLICY "Allow admin to view all chores" ON public.chores
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Allow user to view their own chores" ON public.chores
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for INSERT operations
CREATE POLICY "Allow admin to create chores for any user" ON public.chores
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Allow user to create their own chores" ON public.chores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE operations
CREATE POLICY "Allow admin to update any chore" ON public.chores
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Allow user to update their own chores" ON public.chores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy for DELETE operations
CREATE POLICY "Allow admin to delete any chore" ON public.chores
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Allow user to delete their own chores" ON public.chores
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);