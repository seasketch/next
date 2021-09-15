--! Previous: sha1:aab5712b0bb2543841c54fded163f1feaa4439be
--! Hash: sha1:c47e1fc9e4b437afcf132587b7220a527d64c143

comment on table form_element_types is 'Identifies the type of element in a form, including metadata about that element type.';

comment on column form_element_types.label is 'Form Element name that should be used in the "Form Builder" administrative interface.';

comment on column form_element_types.is_input is 'Whether the element is an input that collects information from users or contains presentational content like a Welcome Message component.';

comment on column form_element_types.is_surveys_only is 'If true, the element type should only be added to forms related to a survey.';

comment on column form_element_types.is_single_use_only is 'These elements can only be added to a form once.';

comment on column form_element_types.label is 'Control form element deployment with feature-flags. If this flag is enabled, the form element should only appear as an option for addition to superuser roles. Once added to a form however, it is visible to all users. No access-control is enforced other than hiding the option in the client.';
