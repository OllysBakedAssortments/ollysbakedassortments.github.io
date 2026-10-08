INSERT OR IGNORE INTO crew_role_permissions (role, permission_key, allowed)
VALUES
('crew','adventures.view',1),
('crew','adventures.create',0),
('crew','adventures.edit',0),
('crew','adventures.publish',0),
('crew','adventures.updates',0),
('crew','adventures.recap',0),
('crew','adventures.relationships',0),
('manager','adventures.view',1),
('manager','adventures.create',1),
('manager','adventures.edit',1),
('manager','adventures.publish',1),
('manager','adventures.updates',1),
('manager','adventures.recap',1),
('manager','adventures.relationships',1);
