-- SQL Migration File: 02_group_id_enforcement.sql

-- Step 1: Altering existing tables to enforce group_id constraints
ALTER TABLE your_table_name
ADD COLUMN group_id INT NOT NULL;

-- Add a foreign key constraint if applicable
ALTER TABLE your_table_name
ADD CONSTRAINT fk_group_id
FOREIGN KEY (group_id)
REFERENCES groups (id);  -- Assuming you have a groups table

-- Step 2: Creating audit table for tracking changes related to group_id
CREATE TABLE group_id_audit (
    id SERIAL PRIMARY KEY,
    your_table_id INT NOT NULL,
    old_group_id INT,
    new_group_id INT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by VARCHAR(255) NOT NULL  -- You might want to store who made the change
);

-- Step 3: (Optional) Create triggers for automatic auditing (if needed)
CREATE OR REPLACE FUNCTION audit_group_id_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_id_audit (your_table_id, old_group_id, new_group_id, changed_at, changed_by)
    VALUES (OLD.id, OLD.group_id, NEW.group_id, NOW(), current_user);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_id_update_trigger
AFTER UPDATE ON your_table_name
FOR EACH ROW
WHEN (OLD.group_id IS DISTINCT FROM NEW.group_id)
EXECUTE FUNCTION audit_group_id_change();