--! Previous: sha1:13c89d64238afefd88bd561fb2e13eae58e4db89
--! Hash: sha1:f0670ef62a7d6e69a1517650bc01b0834432d196

-- Enter migration here

alter type public.spatial_metric_type add value if not exists 'ous_demographics';
