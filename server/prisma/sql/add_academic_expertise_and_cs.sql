-- Academic Tutoring updates:
--   1) New subject (subcategory): "Computer Science & Technology"
--   2) New Areas of Expertise (leaves) under Mathematics, Science, and the new
--      Computer Science & Technology subject.
--
-- Safe to run directly on the database: wrapped in a transaction and idempotent
-- (re-running will not create duplicates). Existing categories/tutor links are untouched.
--
-- Requires an existing "Academic Tutoring" major category (parent_id IS NULL).
-- If it does not exist, this script inserts nothing.

BEGIN;

-- gen_random_uuid() is built into PostgreSQL 13+. The extension covers older versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create the new subject "Computer Science & Technology" under "Academic Tutoring"
--    (skip if it already exists).
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, v.name, at."id"
FROM (
    SELECT "id" FROM "Category" WHERE "name" = 'Academic Tutoring' AND "parent_id" IS NULL LIMIT 1
) at
CROSS JOIN (VALUES
    ('Computer Science & Technology')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c WHERE c."name" = v.name AND c."parent_id" = at."id"
);

-- 2) Create the Areas of Expertise (leaves) under each subject of "Academic Tutoring"
--    (skip any that already exist). The join scopes matching to subjects that live
--    directly under the "Academic Tutoring" major, so we never touch same-named
--    subjects under other majors.
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, e.leaf, sub."id"
FROM "Category" sub
JOIN (
    SELECT "id" FROM "Category" WHERE "name" = 'Academic Tutoring' AND "parent_id" IS NULL LIMIT 1
) at ON sub."parent_id" = at."id"
JOIN (VALUES
    ('Mathematics',                    'Math Foundations'),
    ('Mathematics',                    'Basic Arithmetic'),
    ('Mathematics',                    'Fractions & Decimals'),
    ('Mathematics',                    'SAT/ACT Math Prep'),

    ('Science',                        'General Science'),
    ('Science',                        'Life Science'),

    ('Computer Science & Technology',  'Computer Science Fundamentals'),
    ('Computer Science & Technology',  'AP Computer Science'),
    ('Computer Science & Technology',  'Digital Literacy')
) AS e(sub_name, leaf) ON e.sub_name = sub."name"
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c2 WHERE c2."name" = e.leaf AND c2."parent_id" = sub."id"
);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION (run separately after the migration to confirm everything landed).
-- Lists each targeted subject with its expertise leaves under "Academic Tutoring".
-- ------------------------------------------------------------------------------
-- SELECT sub."name" AS subject, leaf."name" AS area_of_expertise
-- FROM "Category" at
-- JOIN "Category" sub  ON sub."parent_id"  = at."id"
-- JOIN "Category" leaf ON leaf."parent_id" = sub."id"
-- WHERE at."name" = 'Academic Tutoring' AND at."parent_id" IS NULL
--   AND sub."name" IN ('Mathematics', 'Science', 'Computer Science & Technology')
-- ORDER BY sub."name", leaf."name";
