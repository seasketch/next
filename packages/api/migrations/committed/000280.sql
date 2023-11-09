--! Previous: sha1:6e14c22c9b93c63557203d4e25e5627d0ccf58f6
--! Hash: sha1:6084ad8c19dffb844ed6a49cab24caac6dc51841

-- Enter migration here
alter table survey_response_network_addresses drop column if exists updated_at;
alter table survey_response_network_addresses add column if not exists updated_at integer not null default extract(epoch from date_trunc('hour', now())) + (extract(minute FROM now())::int / 5) * 60 * 5;

CREATE OR REPLACE FUNCTION public.before_survey_response_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    existing survey_response_network_addresses;
  begin
    if current_setting('session.request_ip', true) is not null then
      -- first, delete the oldest hashes of request IPs so that this
      -- process doesn't become too inefficient
      delete from 
        survey_response_network_addresses 
      where 
        updated_at <= (
          select 
            greatest(
              -- Two weeks ago,
              (extract(epoch from date_trunc('hour', now())) + 
              (extract(minute FROM now())::int / 5) * 60 * 5) -
              60 * 60 * 24 * 7,
              -- Or the thousandth most recent entry updated_at
              (
                select 
                  updated_at 
                from 
                  survey_response_network_addresses 
                order by 
                  updated_at desc 
                limit 1 offset 1000
              )
            )
        );
      update
        survey_response_network_addresses
      set 
        num_responses = num_responses + 1, 
        updated_at = extract(epoch from date_trunc('hour', now())) + (extract(minute FROM now())::int / 5) * 60 * 5
      where
        ip_hash = crypt(
          current_setting('session.request_ip', true) || NEW.survey_id::text, 
          ip_hash
        )
      returning
        *
      into 
        existing;
      if existing is not null then
        NEW.is_duplicate_ip = true;
      else
        insert into survey_response_network_addresses (
          survey_id, 
          ip_hash
        ) values (
          NEW.survey_id,
          crypt(
            current_setting('session.request_ip', true) || NEW.survey_id::text, 
            gen_salt('md5')
          )
        );
      end if;
    end if;
    return NEW;
  end;
$$;
