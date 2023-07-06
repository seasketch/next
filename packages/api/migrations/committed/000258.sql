--! Previous: sha1:b0f6bb5c7e36a5e5cb0cc4f57b6d64fcbaac16ff
--! Hash: sha1:dbbac2b5c34577e754e2cce642650680cd843550

-- Enter migration here
revoke update(mapbox_gl_style) on sketch_classes from seasketch_user;
revoke insert(mapbox_gl_style) on sketch_classes from seasketch_user;
