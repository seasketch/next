-- Replica skips triggers that would queue jobs for these copied rows.
SET session_replication_role = replica;

-- Copy staged data-library template rows into this database.
-- library_stage.* was loaded from the developer's database. Project copies,
-- personal user rows, and a person's geography clipping settings are not staged.
-- created_by / uploaded_by are rewritten to the synthetic updater user.

DO $$
DECLARE
  updater_id integer;
  superuser_id integer;
  personal_users integer;
BEGIN
  SELECT id INTO updater_id FROM users WHERE sub = 'data-library-template-updater';
  SELECT id INTO superuser_id FROM projects WHERE slug = 'superuser';
  IF updater_id IS NULL OR superuser_id IS NULL THEN
    RAISE EXCEPTION 'snapshot database is missing data-library-template-updater or the superuser project';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM library_stage.table_of_contents_items) THEN
    RAISE EXCEPTION 'no data library templates were staged';
  END IF;

  IF EXISTS (
    SELECT 1 FROM data_sources d
    JOIN library_stage.data_sources s ON s.id = d.id
  ) OR EXISTS (
    SELECT 1 FROM table_of_contents_items d
    JOIN library_stage.table_of_contents_items s ON s.id = d.id
  ) THEN
    RAISE EXCEPTION 'data library ids already exist in the snapshot database';
  END IF;

  PERFORM library_stage.copy_in('interactivity_settings');
  PERFORM library_stage.copy_in('data_sources');
  PERFORM library_stage.copy_in('data_layers');
  PERFORM library_stage.copy_in('table_of_contents_items');
  PERFORM library_stage.copy_in('access_control_lists');
  PERFORM library_stage.copy_in('data_upload_outputs');
  PERFORM library_stage.copy_in('archived_data_sources');
  PERFORM library_stage.copy_in('ai_data_analyst_notes');

  UPDATE data_sources
  SET project_id = superuser_id,
      created_by = CASE WHEN created_by IS NULL THEN NULL ELSE updater_id END,
      uploaded_by = CASE WHEN uploaded_by IS NULL THEN NULL ELSE updater_id END,
      upload_task_id = NULL
  WHERE id IN (SELECT id FROM library_stage.data_sources);

  UPDATE data_layers SET project_id = superuser_id
  WHERE id IN (SELECT id FROM library_stage.data_layers);

  UPDATE table_of_contents_items SET project_id = superuser_id
  WHERE id IN (SELECT id FROM library_stage.table_of_contents_items);

  UPDATE access_control_lists SET project_id = superuser_id
  WHERE id IN (SELECT id FROM library_stage.access_control_lists);

  UPDATE data_upload_outputs SET project_id = superuser_id
  WHERE project_id IS NOT NULL
    AND id IN (SELECT id FROM library_stage.data_upload_outputs);

  UPDATE archived_data_sources SET project_id = superuser_id
  WHERE data_source_id IN (SELECT data_source_id FROM library_stage.archived_data_sources);

  UPDATE ai_data_analyst_notes SET project_id = superuser_id
  WHERE id IN (SELECT id FROM library_stage.ai_data_analyst_notes);

  SELECT count(*) INTO personal_users
  FROM users
  WHERE sub LIKE 'google-oauth2|%' OR sub LIKE 'auth0|%';
  IF personal_users <> 0 THEN
    RAISE EXCEPTION 'snapshot contains % personal auth users', personal_users;
  END IF;
END
$$;

SET session_replication_role = origin;

DO $$
DECLARE
  rel text;
  seq text;
  max_id bigint;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'data_sources',
    'data_layers',
    'table_of_contents_items',
    'interactivity_settings',
    'access_control_lists',
    'data_upload_outputs',
    'ai_data_analyst_notes'
  ]
  LOOP
    seq := pg_get_serial_sequence('public.' || rel, 'id');
    IF seq IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT max(id) FROM public.%I', rel) INTO max_id;
    IF max_id IS NOT NULL THEN
      PERFORM setval(seq, max_id);
    END IF;
  END LOOP;
END
$$;
