--! Previous: sha1:9ac5340f3099df1d7c250b020a1643cc53748ee6
--! Hash: sha1:5a121ffbecd4ef38ef0cfe56433328d5d5c3dd39

-- Enter migration here
create table if not exists data_source_requests (
  project_id int not null references projects(id) on delete cascade,
  data_source_id int not null references data_sources(id) on delete cascade,
  timestamp timestamp with time zone not null,
  interval interval not null,
  count int not null,
  primary key (project_id, data_source_id, timestamp, interval)
);

create or replace function rollup_data_source_requests()
  returns void
  language sql
  security definer
  as $$
    insert into data_source_requests (
      project_id, 
      data_source_id, 
      timestamp, 
      interval, 
      count
    )
    select 
      project_id, 
      data_source_id, 
      date(timestamp) as timestamp,
      interval '1 day' as interval,
      sum(count) as count
    from 
      data_source_requests 
    where
      interval = interval '15 minutes' and
      date(timestamp) >= current_date - interval '2 days'
    group by 
      project_id, 
      data_source_id, 
      date(timestamp) 
    on conflict (project_id, data_source_id, timestamp, interval) do update
      set count = excluded.count;
  $$;

drop function if exists projects_most_used_layers;
create or replace function projects_most_used_layers(project projects, period public.activity_stats_period)
  returns setof public.table_of_contents_items
  language sql
  stable
  security definer
  as $$
    select * from table_of_contents_items where data_layer_id = any (
      select data_layer_id from (
        select 
          sum(count), 
          data_source_requests.data_source_id, 
          data_layers.id as data_layer_id
        from 
          data_source_requests 
        inner join 
          data_layers 
        on 
          data_layers.data_source_id = data_source_requests.data_source_id 
        where
          data_source_requests.project_id = project.id and  
          interval = (
            case period
              when '24hrs' then '15 minutes'::interval
              when '7-days' then '1 hour'::interval
              when '30-days' then '1 day'::interval
              when '6-months' then '1 day'::interval
              when '1-year' then '1 day'::interval
              when 'all-time' then '1 day'::interval
              else '1 day'::interval
            end
          ) and timestamp >= now() - (
            case period
              when '24hrs' then interval '1 day'
              when '7-days' then interval '7 days'
              when '30-days' then interval '30 days'
              when '6-months' then interval '6 months'
              when '1-year' then interval '1 year'
              when 'all-time' then interval '100 years'
              else interval '1 year'
            end
          )
        group by 
          data_source_requests.data_source_id, 
          data_layers.id
        order by sum desc
        limit 10
      ) as most_used_data_layers
    );


    -- select * from table_of_contents_items where session_is_admin(project.id) and data_layer_id = any (
    --   select id from data_layers where data_source_id = any (
    --     select data_source_id from (
    --       select 
    --         data_source_id, 
    --         sum(count) as sum
    --       from 
    --         data_source_requests 
    --       where 
    --         project_id = project.id and 
    --         interval = (
    --           case period
    --             when '24hrs' then '15 minutes'::interval
    --             when '7-days' then '1 hour'::interval
    --             when '30-days' then '1 day'::interval
    --             when '6-months' then '1 day'::interval
    --             when '1-year' then '1 day'::interval
    --             when 'all-time' then '1 day'::interval
    --             else '1 day'::interval
    --           end
    --         ) and timestamp >= now() - (
    --           case period
    --             when '24hrs' then interval '1 day'
    --             when '7-days' then interval '7 days'
    --             when '30-days' then interval '30 days'
    --             when '6-months' then interval '6 months'
    --             when '1-year' then interval '1 year'
    --             when 'all-time' then interval '100 years'
    --             else interval '1 year'
    --           end
    --         )
    --       group by 
    --         data_source_id
    --       order by sum desc 
    --       limit 10
    --     ) as most_used_data_sources
    --   )
    -- )
  $$;

grant execute on function projects_most_used_layers to seasketch_user;

comment on function projects_most_used_layers is '@simpleCollections only';
drop function if exists table_of_contents_items_total_requests;
create or replace function table_of_contents_items_total_requests(item table_of_contents_items, period activity_stats_period)
  returns integer
  language sql
  stable
  security definer
  as $$
    select sum(count) from data_source_requests where interval = (
      case period
        when '24hrs' then '15 minutes'::interval
        when '7-days' then '1 hour'::interval
        when '30-days' then '1 day'::interval
        when '6-months' then '1 day'::interval
        when '1-year' then '1 day'::interval
        when 'all-time' then '1 day'::interval
        else '1 day'::interval
      end
    ) and timestamp >= now() - (
      case period
        when '24hrs' then interval '1 day'
        when '7-days' then interval '7 days'
        when '30-days' then interval '30 days'
        when '6-months' then interval '6 months'
        when '1-year' then interval '1 year'
        when 'all-time' then interval '100 years'
        else interval '1 year'
      end
    )
    and data_source_id = (
      select 
        data_source_id 
      from 
        data_layers 
      where id = item.data_layer_id
    )
  $$;

grant execute on function table_of_contents_items_total_requests to seasketch_user;
