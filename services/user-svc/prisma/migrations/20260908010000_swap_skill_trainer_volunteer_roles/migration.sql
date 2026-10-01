-- Swap the DB role values behind two app roles.
--
-- Before: app "Skill Trainer" was stored as `volunteer`
--         app "Community Member" was stored as `student`
-- After:  app "Skill Trainer"    is stored as `student`
--         app "Volunteer" (renamed from Community Member) is stored as `volunteer`
--
-- This realigns the stored value with the app's vocabulary: the role a user
-- picks as "Volunteer" is now literally `volunteer` in the database. The
-- Skill Trainer role-detail columns added in 20260908000000 are gated on this
-- value in user-svc (see hasRequiredRoleFields in src/routes/profile.routes.ts),
-- so the two must change together.
--
-- ⚠️  THIS MIGRATION IS NOT IDEMPOTENT — it is a swap. Running it a second time
-- silently swaps the roles back. Prisma's _prisma_migrations table guarantees it
-- runs exactly once; never re-run this file by hand against a database that has
-- already had it applied.
--
-- The swap must happen in ONE statement. Two sequential UPDATEs
-- (volunteer→student, then student→volunteer) would feed the first statement's
-- output into the second and collapse both roles into one.
--
-- `roles` is a Role[] array, so each element is remapped individually with
-- WITH ORDINALITY preserving the original array order.

UPDATE users u
SET roles = sub.new_roles
FROM (
  SELECT x.id,
         array_agg(
           CASE t.r
             WHEN 'volunteer'::"Role" THEN 'student'::"Role"
             WHEN 'student'::"Role"   THEN 'volunteer'::"Role"
             ELSE t.r
           END
           ORDER BY t.ord
         ) AS new_roles
  FROM users x
  CROSS JOIN LATERAL unnest(x.roles) WITH ORDINALITY AS t(r, ord)
  WHERE x.roles && ARRAY['volunteer', 'student']::"Role"[]
  GROUP BY x.id
) AS sub
WHERE u.id = sub.id;
