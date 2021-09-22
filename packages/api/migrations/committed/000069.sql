--! Previous: sha1:074b31db599fea8065663578a19f4f1b0a65b6fb
--! Hash: sha1:9a25a0b2b8db5f74c9c8d54b4effbde7e6b98b52

-- Enter migration here
COMMENT ON TABLE public.form_elements IS '
@omit all
*FormElements* represent input fields or read-only content in a form. Records contain fields to support
generic functionality like body, position, and isRequired. They 
also have a JSON `componentSettings` field that can have custom data to support
a particular input type, indicated by the `type` field.

Project administrators have full control over managing form elements through
graphile-generated CRUD mutations.
';

comment on column form_elements.body is '
[prosemirror](https://prosemirror.net/) document representing a rich-text question or informational content. Level 1 headers can be assumed to be the question for input-type fields, though formatting is up to the project administrators. Clients should provide a template that encourages this convention when building forms.
';
