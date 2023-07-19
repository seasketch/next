--! Previous: sha1:009d1682c8b8c500594f007e9feb10b9ca1b9d08
--! Hash: sha1:c4567342bd0fbbeb4d40509466ce4ad53cb5e0d6

-- Enter migration here
ALTER TYPE data_upload_state ADD VALUE if not exists 'cartography';
ALTER TYPE data_upload_state ADD VALUE if not exists 'worker_complete';
