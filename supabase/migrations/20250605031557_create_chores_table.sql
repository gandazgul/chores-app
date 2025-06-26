create table public.chores (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  title text not null,
  description text null,
  priority integer null,
  done boolean null default false,
  due_date timestamp with time zone null,
  remind_until_done boolean null default false,
  recurrence jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint chores_pkey primary key (id),
  constraint chores_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

-- Assuming the function update_updated_at_column() already exists.
-- If not, it would need to be defined, e.g.:
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = chores
AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

create trigger update_chores_updated_at BEFORE
update on chores for EACH row
execute FUNCTION update_updated_at_column ();

comment on column public.chores.recurrence is 'Stores rSchedule rule options as JSONB';
comment on column public.chores.title is 'The main name or title of the chore';
comment on column public.chores.done is 'Indicates if the chore has been completed';
