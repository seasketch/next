--! Previous: sha1:89bc2d1cb937fed7eff0f80d38832d6f6f38e2a9
--! Hash: sha1:a4054c704743dde758754f94225f8538193f2ec0

-- Enter migration here
delete from form_elements where form_id = (select id from forms where template_name = 'Basic Template' and template_type = 'SURVEYS') and type_id = 'Consent';
insert into form_elements (form_id, is_required, export_id, component_settings, type_id, body) values ((select id from forms where template_name = 'Basic Template' and template_type = 'SURVEYS'), true, 'consent', '{"documentLabel":"Data Sharing Agreement","presentation":"yesno","documentVersion":0,"requireDocClick":false,"signaturePlaceholder":"Enter your full name"}'::jsonb, 'Consent', '{"type":"doc","content":[{"type":"question","attrs":{},"content":[{"text":"Informed Consent","type":"text"}]},{"type":"paragraph","content":[{"text":"Inform your users why you are collecting this data, who will use these data and how, and how their personal information will be protected. Upload a document with the full terms of the agreement, which they can keep for their reference.","type":"text"}]}]}'::jsonb);
