--! Previous: sha1:ba0eb22ac8ff0f3a3c4e707b53ba8ce27807505a
--! Hash: sha1:88ea156673a7d82b63e484ab0d633bddc174a5e0

-- Enter migration here
CREATE OR REPLACE FUNCTION public.filter_state_to_search_string(filters jsonb, sketch_class_id integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    state jsonb := '{}';
    filter jsonb;
    attr text;
    result text;
    attribute_name text;
    filter_server_location text;
    filter_version int;
    final_url text;
BEGIN
    -- Retrieve the filter_api_server_location and filter_api_version from sketch_classes table
    SELECT sketch_classes.filter_api_server_location, sketch_classes.filter_api_version
    INTO filter_server_location, filter_version
    FROM sketch_classes
    WHERE id = sketch_class_id;

    -- If filter_api_server_location is NULL, return NULL
    IF filter_server_location IS NULL THEN
        RETURN NULL;
    END IF;

    filter_server_location := regexp_replace(filter_server_location, '/$', '', '');

    -- Loop through each attribute in the input JSONB object
    FOR attr, filter IN
        SELECT key, value FROM jsonb_each(filters)
    LOOP
        -- Only process if "selected" is true
        IF filter->>'selected' = 'true' THEN
            if filter->>'attribute' is not null then
                attribute_name := filter->>'attribute';
            else
              -- Look up the attribute name from form_elements for the current attr ID
              SELECT component_settings->>'attribute'
              INTO attribute_name
              FROM form_elements
              WHERE id = attr::int; -- Cast attr to integer to match form_elements ID
            end if;


            -- Default to the original key if no match is found
            IF attribute_name IS NULL THEN
                attribute_name := attr;
            END IF;

            -- Check for numberState
            IF filter ? 'numberState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'min', filter->'numberState'->'min',
                    'max', filter->'numberState'->'max'
                ));

            -- Check for stringState
            ELSIF filter ? 'stringState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'choices', filter->'stringState'
                ));

            -- Check for booleanState
            ELSIF filter ? 'booleanState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'bool', COALESCE(filter->'booleanState', 'false')::boolean
                ));
            END IF;
        END IF;
    END LOOP;

    -- If no keys were added, return an empty string; otherwise, encode the JSON
    IF state = '{}'::jsonb THEN
        RETURN filter_server_location || '/v' || filter_version || '/mvt/{z}/{x}/{y}.pbf';
    ELSE
        -- Convert the JSONB object to a text string without formatting
        result := state::text;

        -- URL encode the resulting JSON text using the updated url_encode function
        result := url_encode(result);

        -- Construct the final URL
        final_url := filter_server_location || '/v' || filter_version || '/mvt/{z}/{x}/{y}.pbf?filter=' || result;
        RETURN final_url;
    END IF;
END;
$$;
