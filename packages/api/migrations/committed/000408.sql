--! Previous: sha1:c47bf43a267561562d6547dfa1f07b01a42de4c5
--! Hash: sha1:dc9cf8823cf60ccf033f246448267dadad86d479

-- Fix verify_table_of_contents_items_have_report_outputs: assigning a scalar id
-- into an integer[] variable coerces through the array text parser and raises
-- "malformed array literal" (e.g. for id 45434). Aggregate with array_agg instead.

CREATE OR REPLACE FUNCTION public.verify_table_of_contents_items_have_report_outputs(toc_item_ids integer[]) RETURNS integer[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      items_missing_outputs integer[];
    BEGIN
      SELECT coalesce(array_agg(id), '{}'::integer[])
      FROM (
        SELECT id, table_of_contents_items_reporting_output(table_of_contents_items.*) AS output
        FROM table_of_contents_items
        WHERE id = ANY(toc_item_ids)
      ) AS foo
      WHERE foo.output IS NULL
      INTO items_missing_outputs;

      RETURN coalesce(items_missing_outputs, '{}'::integer[]);
    END;
    $$;
