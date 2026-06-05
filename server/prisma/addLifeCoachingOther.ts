import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotently add a "Other" subcategory (with an "Other" expertise leaf) under
// the existing "Life Coaching" major category — WITHOUT wiping existing data.
// The selector is leaf-based, so the subcategory needs a Level-3 leaf to be
// selectable. Safe to re-run; it only creates what's missing.
async function main() {
    const lifeCoaching = await prisma.category.findFirst({
        where: { name: 'Life Coaching', parent_id: null },
    });

    if (!lifeCoaching) {
        throw new Error('No "Life Coaching" major category found. Run seed:categories first.');
    }

    let other = await prisma.category.findFirst({
        where: { name: 'Other', parent_id: lifeCoaching.id },
    });

    if (!other) {
        other = await prisma.category.create({
            data: { name: 'Other', parent_id: lifeCoaching.id },
        });
        console.log(`Created subcategory "Other" under Life Coaching (${other.id})`);
    } else {
        console.log('Subcategory "Other" already exists under Life Coaching.');
    }

    const otherLeaf = await prisma.category.findFirst({
        where: { name: 'Other', parent_id: other.id },
    });

    if (!otherLeaf) {
        const leaf = await prisma.category.create({
            data: { name: 'Other', parent_id: other.id },
        });
        console.log(`Created expertise leaf "Other" under Life Coaching > Other (${leaf.id})`);
    } else {
        console.log('Expertise leaf "Other" already exists.');
    }

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
