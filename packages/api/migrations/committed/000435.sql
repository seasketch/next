--! Previous: sha1:36d9af70612b7bf471327dc667dc00cb9ea0a850
--! Hash: sha1:13c89d64238afefd88bd561fb2e13eae58e4db89

-- Enter migration here

-- Hide reports.draft_id FK relations from GraphQL. Clients only need the scalar
-- draftId (published snapshots point at their draft lineage root). The reverse
-- connection and nested draft field are unused and caused schema drift between
-- DBs that introspect this FK differently under ignoreRBAC.
comment on constraint reports_draft_id_fkey on public.reports is E'@omit';
comment on column public.reports.draft_id is E'@omit filter,order';
