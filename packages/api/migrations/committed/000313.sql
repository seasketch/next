--! Previous: sha1:7c24ab0b63a0ab43203b8ffa6679ea2a0a0da71e
--! Hash: sha1:fbec08c9b15710e1b43d0302f5a8e31bfa1034bc

-- Enter migration here
CREATE OR REPLACE FUNCTION add_default_basemaps(pid int)
  RETURNS void
  LANGUAGE plpgsql
  security definer
  AS $$
    declare
      basemapid int;
    begin
      insert into basemaps (
        project_id,
        name,
        url,
        labels_layer_id,
        thumbnail,
        attribution,
        type
      ) values (
        pid,
        'Light',
        'mapbox://styles/seasketch/cltyob7pm01vf01oi6w1zbmbp',
        'path-pedestrian-label',
        'https://d17krkm4g5m2af.cloudfront.net/937928e3-22a1-436c-999a-9d59b18d835c.png',
        '<a href="https://marineregions.org" target="_blank">MarineRegions.org</a>',
        'MAPBOX'
      ) returning id into basemapid;
      insert into optional_basemap_layers (
        basemap_id,
        layers,
        default_visibility,
        name,
        metadata
      ) values (
        basemapid,
        '{eez,eez-labels}',
        true,
        'EEZ Boundaries',
        '{"type": "doc", "content": [{"type": "paragraph", "content": [{"text": "Flanders Marine Institute (2020). Union of the ESRI Country shapefile and the Exclusive Economic Zones (version 3). Available online at ", "type": "text"}, {"text": "https://www.marineregions.org/", "type": "text", "marks": [{"type": "link", "attrs": {"href": "https://www.marineregions.org/", "title": null}}]}, {"text": ". ", "type": "text"}, {"text": "https://doi.org/10.14284/403", "type": "text", "marks": [{"type": "link", "attrs": {"href": "https://doi.org/10.14284/403", "title": null}}]}, {"text": ". Consulted on 2024-03-19.", "type": "text"}]}]}'::jsonb
      );
      
      insert into basemaps (
        project_id,
        name,
        url,
        labels_layer_id,
        thumbnail,
        attribution,
        type
      ) values (
        pid,
        'Satellite',
        'mapbox://styles/seasketch/cltypb2ym01w301o82akda443',
        'path-pedestrian-label',
        'https://d17krkm4g5m2af.cloudfront.net/a78a89e5-86f9-46ec-99f6-c24946e01010.png',
        '<a href="https://marineregions.org" target="_blank">MarineRegions.org</a>',
        'MAPBOX'
      ) returning id into basemapid;
      insert into optional_basemap_layers (
        basemap_id,
        layers,
        default_visibility,
        name,
        metadata
      ) values (
        basemapid,
        '{eez,eez-labels}',
        true,
        'EEZ Boundaries',
        '{"type": "doc", "content": [{"type": "paragraph", "content": [{"text": "Flanders Marine Institute (2020). Union of the ESRI Country shapefile and the Exclusive Economic Zones (version 3). Available online at ", "type": "text"}, {"text": "https://www.marineregions.org/", "type": "text", "marks": [{"type": "link", "attrs": {"href": "https://www.marineregions.org/", "title": null}}]}, {"text": ". ", "type": "text"}, {"text": "https://doi.org/10.14284/403", "type": "text", "marks": [{"type": "link", "attrs": {"href": "https://doi.org/10.14284/403", "title": null}}]}, {"text": ". Consulted on 2024-03-19.", "type": "text"}]}]}'::jsonb
      );
    end;
  $$;


CREATE OR REPLACE FUNCTION public.create_project(name text, slug text, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed, creator_id, support_email) 
        values (name, slug, false, current_setting('session.user_id', true)::int, current_setting('session.canonical_email', true)) returning * into project;
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved, 
        share_profile
      ) values (
        current_setting('session.user_id', true)::int, 
        project.id, 
        true, 
        true, 
        true
      );
      perform add_default_basemaps(project.id);
    else
      raise exception 'Email must be verified to create a project';
    end if;
  end
$$;

-- Add default basemaps to existing projects that don't have any
select id, add_default_basemaps(id) from (select
  ((select count(*) from basemaps where project_id = projects.id)) as basemap_count,
  projects.id,
  projects.slug
 from projects) as subquery where basemap_count = 0;
