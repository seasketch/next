--! Previous: sha1:b5d8c88fbd2f3104dbb36adcb8af92d9bfa2e272
--! Hash: sha1:bbe7c9b64e6c88b4e2c8db633c4e07785ff3fada

-- Enter migration here
comment on table form_element_types is '
@simpleCollections only
Identifies the type of element in a form, including metadata about that element type.
';
