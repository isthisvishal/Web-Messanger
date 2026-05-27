-- Enforce only one SUPER_ADMIN at the database level using a partial unique index
CREATE UNIQUE INDEX "one_super_admin" ON "User" ("role") WHERE "role" = 'SUPER_ADMIN';
