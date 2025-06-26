-- Create the user_fcm_tokens table
CREATE TABLE public.user_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments to the table and columns
COMMENT ON TABLE public.user_fcm_tokens IS 'Stores FCM registration tokens for users.';
COMMENT ON COLUMN public.user_fcm_tokens.id IS 'Unique identifier for the token record.';
COMMENT ON COLUMN public.user_fcm_tokens.user_id IS 'Foreign key to the user in auth.users.';
COMMENT ON COLUMN public.user_fcm_tokens.fcm_token IS 'Firebase Cloud Messaging registration token.';
COMMENT ON COLUMN public.user_fcm_tokens.created_at IS 'Timestamp of when the token was first added.';
COMMENT ON COLUMN public.user_fcm_tokens.updated_at IS 'Timestamp of when the token was last updated.';

-- Enable RLS
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can insert their own FCM tokens
CREATE POLICY "Allow users to insert their own FCM tokens"
ON public.user_fcm_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can select their own FCM tokens
CREATE POLICY "Allow users to select their own FCM tokens"
ON public.user_fcm_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own FCM tokens
CREATE POLICY "Allow users to update their own FCM tokens"
ON public.user_fcm_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own FCM tokens
CREATE POLICY "Allow users to delete their own FCM tokens"
ON public.user_fcm_tokens
FOR DELETE
USING (auth.uid() = user_id);


-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
SET search_path = chores
AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER set_public_user_fcm_tokens_updated_at
BEFORE UPDATE ON public.user_fcm_tokens
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_public_user_fcm_tokens_updated_at ON public.user_fcm_tokens IS 'Trigger to set updated_at to current timestamp on row update.';
