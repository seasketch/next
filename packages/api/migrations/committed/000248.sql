--! Previous: sha1:51c6880109b100aa9a2e0bc5ad4352fb95396ea8
--! Hash: sha1:945ca4dc7582db640b09f81ef1b35ddb0439d30a

-- Enter migration here
-- Not sure why this cropped up. Might be a dev machine issue. No harm done.
grant execute on function users_participation_status to seasketch_user;


create or replace function send_email_verification_for_new_user() returns trigger language plpgsql as $$
BEGIN
  perform graphile_worker.add_job(
    'sendEmailVerification',
    json_build_object(
      'sub', NEW.sub,
      'email', NEW.canonical_email
    )
  );
  RETURN NEW;
END;
$$;

DROP trigger IF EXISTS send_email_verification ON users;
CREATE TRIGGER send_email_verification AFTER INSERT OR UPDATE OR DELETE
ON users
FOR EACH ROW
EXECUTE PROCEDURE send_email_verification_for_new_user();
