--! Previous: sha1:dfb905d236af17edca2ba09fe5cb5b85b0b1aaee
--! Hash: sha1:4bbe22071aa68c72dc111488125322e5b7dad9a2

-- Enter migration here
alter table users alter column canonical_email set not null;
