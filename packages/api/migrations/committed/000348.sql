--! Previous: sha1:90ea7a3aac6c1bbbe0a2e80c9e975cf5b1a96421
--! Hash: sha1:817b3e2fce168f500f965b904ec6e9163510ef27

-- Enter migration here
alter type file_upload_usage add value if not exists 'about_page';
