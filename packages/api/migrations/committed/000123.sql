--! Previous: sha1:1ab744b3e85c1c397fe569304b0a306c1996dbdf
--! Hash: sha1:697a029523cecdd849f726650886ac4c50a27324

-- Enter migration here
grant select on survey_consent_documents to seasketch_user;

alter table survey_consent_documents enable row level security;

drop policy if exists survey_consent_documents_admin_access on survey_consent_documents;
create policy survey_consent_documents_admin_access on survey_consent_documents using (session_is_admin(project_id_from_field_id(form_element_id)));
