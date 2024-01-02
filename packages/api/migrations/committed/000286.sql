--! Previous: sha1:ce627d322f59b0d212d699b84f86719b0a480cc8
--! Hash: sha1:e6c5fc331e8c572d3e8b7f38f6049415b3e7a7f3

-- Enter migration here
ALTER TYPE interactivity_type ADD VALUE IF NOT EXISTS 'SIDEBAR_OVERLAY';

alter table interactivity_settings add column if not exists title text not null default '';
