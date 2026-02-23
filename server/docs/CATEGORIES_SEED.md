# Category seed (Find Mentor + mentor services)

The app uses a single category tree for:

- **Find Mentor** (student): major → subcategory → areas of expertise
- **Mentor services**: mentors pick categories/subcategories/areas from the same tree

Definitions live in **`server/prisma/seedCategories.ts`** (Academic Tutoring, Skill Development, Life Coaching and their subcategories/areas).

## If you see "No subcategories found" or old categories

The database may have outdated or test data. Reset and re-seed categories:

```bash
cd server
npm run seed:categories
```

This will:

1. Delete all `TutorCategory` links (mentors’ category selections).
2. Delete all categories.
3. Recreate the tree from `seedCategories.ts`.

**After running it:** mentors must re-select their categories in their profile (Services section).

## Changing the category list

Edit `server/prisma/seedCategories.ts`, then run `npm run seed:categories` again.
