--! Previous: sha1:8e2e11157dccb12056c70b51bd23bf5ab2228487
--! Hash: sha1:1f054d2bf37800746a8156a63c5de0785980d4e0

-- Enter migration here
revoke update on survey_responses from seasketch_user;
grant update(data, is_draft, updated_at, is_practice, archived) on survey_responses to seasketch_user;
