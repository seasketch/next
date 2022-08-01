--! Previous: sha1:b517f6433954d9049e41c95884c622e63c2425bb
--! Hash: sha1:cf508692ae21c6b024f5b25ea67a93c146a20af8

-- Enter migration here
alter table survey_responses add column if not exists offline_id uuid unique;

comment on column survey_responses.offline_id is 'Should be used by clients to uniquely identify responses that are collected offline. Survey facilitators can download their responses to disk as json so that they may be recovered/submitted in the case of the client machine being damaged or stolen. Tracking an offline uuid ensures that these responses are not somehow submitted in duplicate.'
