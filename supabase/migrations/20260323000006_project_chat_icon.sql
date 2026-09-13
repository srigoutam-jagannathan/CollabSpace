-- Add chat_icon_url to projects for group chat customisation
alter table projects add column if not exists chat_icon_url text null;
