DELETE FROM center_contacts a USING center_contacts b WHERE a.id < b.id AND a.center_key = b.center_key;
ALTER TABLE center_contacts ADD CONSTRAINT idx_center_contacts_key_unique UNIQUE (center_key);
