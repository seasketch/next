-- Enter migration here
ALTER TYPE interactivity_type ADD VALUE IF NOT EXISTS 'SIDEBAR_OVERLAY';

alter table interactivity_settings add column if not exists title text not null default '';