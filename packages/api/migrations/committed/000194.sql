--! Previous: sha1:53bb7c7048f37a43ae0cb6d316476a3a74078596
--! Hash: sha1:795081ed4e5a737cd93e640b3943266d92a86384

-- Enter migration here
grant execute on function unaccent(regdictionary, text) to anon;
grant execute on function unaccent(text) to anon;
