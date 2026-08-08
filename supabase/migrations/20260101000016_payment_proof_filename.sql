-- Original uploaded filename, shown as an attachment link on the admin
-- review queue (storage path itself is a random/opaque path, not the name
-- the business owner would recognize).
alter table payment_submissions add column proof_filename text;
