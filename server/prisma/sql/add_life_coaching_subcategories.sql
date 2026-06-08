-- Add 9 new subcategories (each with expertise leaves) under "Life Coaching".
-- Safe to run directly on the database: wrapped in a transaction and idempotent
-- (re-running will not create duplicates). Existing categories/tutor links are untouched.
--
-- Requires an existing "Life Coaching" major category (parent_id IS NULL).
-- If it does not exist, this script inserts nothing.

BEGIN;

-- gen_random_uuid() is built into PostgreSQL 13+. The extension covers older versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create the 9 subcategories under "Life Coaching" (skip any that already exist).
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, v.name, lc."id"
FROM (
    SELECT "id" FROM "Category" WHERE "name" = 'Life Coaching' AND "parent_id" IS NULL LIMIT 1
) lc
CROSS JOIN (VALUES
    ('Health & Wellness'),
    ('Weight Management'),
    ('Burnout & Work-Life Balance'),
    ('Student Success & College Readiness'),
    ('Career Development & Transition'),
    ('Relationship & Family'),
    ('Neurodiversity & Executive Function'),
    ('NLP (Neuro-Linguistic Programming)'),
    ('Business')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c WHERE c."name" = v.name AND c."parent_id" = lc."id"
);

-- 2) Create the expertise leaves under each subcategory (skip any that already exist).
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, e.leaf, sub."id"
FROM "Category" sub
JOIN (
    SELECT "id" FROM "Category" WHERE "name" = 'Life Coaching' AND "parent_id" IS NULL LIMIT 1
) lc ON sub."parent_id" = lc."id"
JOIN (VALUES
    ('Health & Wellness',                  'Healthy Habits'),
    ('Health & Wellness',                  'Nutrition & Lifestyle'),
    ('Health & Wellness',                  'Stress Reduction'),
    ('Health & Wellness',                  'Sleep Optimization'),

    ('Weight Management',                   'Sustainable Weight Loss'),
    ('Weight Management',                   'Healthy Eating Habits'),
    ('Weight Management',                   'Accountability Coaching'),
    ('Weight Management',                   'Behavior Change'),

    ('Burnout & Work-Life Balance',        'Burnout Recovery'),
    ('Burnout & Work-Life Balance',        'Boundary Setting'),
    ('Burnout & Work-Life Balance',        'Energy Management'),
    ('Burnout & Work-Life Balance',        'Work-Life Integration'),

    ('Student Success & College Readiness','Study Skills'),
    ('Student Success & College Readiness','Academic Goal Setting'),
    ('Student Success & College Readiness','College Preparation'),
    ('Student Success & College Readiness','Time Management'),

    ('Career Development & Transition',     'Career Planning'),
    ('Career Development & Transition',     'Career Change'),
    ('Career Development & Transition',     'Job Search Strategy'),
    ('Career Development & Transition',     'Workplace Confidence'),

    ('Relationship & Family',               'Healthy Communication'),
    ('Relationship & Family',               'Conflict Resolution'),
    ('Relationship & Family',               'Trust Building'),
    ('Relationship & Family',               'Parent-Child Communication'),
    ('Relationship & Family',               'Boundary Setting'),

    ('Neurodiversity & Executive Function', 'ADHD Coaching'),
    ('Neurodiversity & Executive Function', 'Organization Skills'),
    ('Neurodiversity & Executive Function', 'Focus Strategies'),
    ('Neurodiversity & Executive Function', 'Time Management'),

    ('NLP (Neuro-Linguistic Programming)',  'Limiting Belief Transformation'),
    ('NLP (Neuro-Linguistic Programming)',  'Mindset Reframing'),
    ('NLP (Neuro-Linguistic Programming)',  'Goal Achievement'),
    ('NLP (Neuro-Linguistic Programming)',  'Confidence Building'),

    ('Business',                            'Entrepreneurship'),
    ('Business',                            'Business Strategy'),
    ('Business',                            'Leadership Development'),
    ('Business',                            'Personal Branding')
) AS e(sub_name, leaf) ON e.sub_name = sub."name"
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c2 WHERE c2."name" = e.leaf AND c2."parent_id" = sub."id"
);

COMMIT;
