-- Add 13 new subcategories (each with expertise leaves) under "Skill Development".
-- Safe to run directly on the database: wrapped in a transaction and idempotent
-- (re-running will not create duplicates). Existing categories/tutor links are untouched.
--
-- Requires an existing "Skill Development" major category (parent_id IS NULL).
-- If it does not exist, this script inserts nothing.

BEGIN;

-- gen_random_uuid() is built into PostgreSQL 13+. The extension covers older versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create the 13 subcategories under "Skill Development" (skip any that already exist).
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, v.name, sd."id"
FROM (
    SELECT "id" FROM "Category" WHERE "name" = 'Skill Development' AND "parent_id" IS NULL LIMIT 1
) sd
CROSS JOIN (VALUES
    ('Photography'),
    ('Cooking & Culinary Arts'),
    ('Makeup Artistry'),
    ('Content Creation'),
    ('Real Estate'),
    ('Graphic Design'),
    ('Digital Marketing'),
    ('Video Editing'),
    ('Artificial Intelligence'),
    ('Fashion & Styling'),
    ('Interior Design'),
    ('Fitness Instruction'),
    ('Language Learning')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c WHERE c."name" = v.name AND c."parent_id" = sd."id"
);

-- 2) Create the expertise leaves under each subcategory (skip any that already exist).
INSERT INTO "Category" ("id", "name", "parent_id")
SELECT gen_random_uuid()::text, e.leaf, sub."id"
FROM "Category" sub
JOIN (
    SELECT "id" FROM "Category" WHERE "name" = 'Skill Development' AND "parent_id" IS NULL LIMIT 1
) sd ON sub."parent_id" = sd."id"
JOIN (VALUES
    ('Photography',              'Portrait Photography'),
    ('Photography',              'Event Photography'),
    ('Photography',              'Photo Editing'),
    ('Photography',              'Mobile Photography'),

    ('Cooking & Culinary Arts',  'Home Cooking'),
    ('Cooking & Culinary Arts',  'Baking & Pastry'),
    ('Cooking & Culinary Arts',  'International Cuisine'),
    ('Cooking & Culinary Arts',  'Meal Planning'),

    ('Makeup Artistry',          'Everyday Makeup'),
    ('Makeup Artistry',          'Bridal Makeup'),
    ('Makeup Artistry',          'Glam Makeup'),
    ('Makeup Artistry',          'Skincare Fundamentals'),

    ('Content Creation',         'Personal Branding'),
    ('Content Creation',         'Video Content Creation'),
    ('Content Creation',         'Content Strategy'),
    ('Content Creation',         'Social Media Growth'),

    ('Real Estate',              'Real Estate Fundamentals'),
    ('Real Estate',              'Property Investing'),
    ('Real Estate',              'Real Estate Sales'),
    ('Real Estate',              'First-Time Home Buying'),

    ('Graphic Design',           'Canva Design'),
    ('Graphic Design',           'Branding Design'),
    ('Graphic Design',           'Social Media Graphics'),
    ('Graphic Design',           'Design Fundamentals'),

    ('Digital Marketing',        'Social Media Marketing'),
    ('Digital Marketing',        'Email Marketing'),
    ('Digital Marketing',        'SEO Basics'),
    ('Digital Marketing',        'Content Marketing'),

    ('Video Editing',            'Adobe Premiere Pro'),
    ('Video Editing',            'CapCut Editing'),
    ('Video Editing',            'YouTube Editing'),
    ('Video Editing',            'Short-Form Content'),

    ('Artificial Intelligence',  'AI Tools & Productivity'),
    ('Artificial Intelligence',  'Prompt Engineering'),
    ('Artificial Intelligence',  'AI for Business'),
    ('Artificial Intelligence',  'Generative AI'),

    ('Fashion & Styling',        'Personal Styling'),
    ('Fashion & Styling',        'Wardrobe Planning'),
    ('Fashion & Styling',        'Color Analysis'),
    ('Fashion & Styling',        'Fashion Fundamentals'),

    ('Interior Design',          'Home Styling'),
    ('Interior Design',          'Space Planning'),
    ('Interior Design',          'Color Coordination'),
    ('Interior Design',          'Decor Design'),

    ('Fitness Instruction',      'Strength Training'),
    ('Fitness Instruction',      'Weight Loss Fitness'),
    ('Fitness Instruction',      'Mobility Training'),
    ('Fitness Instruction',      'Exercise Fundamentals'),

    ('Language Learning',        'Conversational Language Skills'),
    ('Language Learning',        'Grammar & Writing'),
    ('Language Learning',        'Pronunciation & Accent Improvement'),
    ('Language Learning',        'Language Proficiency & Fluency')
) AS e(sub_name, leaf) ON e.sub_name = sub."name"
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c2 WHERE c2."name" = e.leaf AND c2."parent_id" = sub."id"
);

COMMIT;
