--! Previous: sha1:25d03ab81a704dcb20848a1724e13ae93acbde1d
--! Hash: sha1:9e119f25972d935fc756caf683106ef3eda95321

-- Enter migration here
grant execute on function create_bbox(geometry, int) to anon;
