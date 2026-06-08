import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
    {
        name: "Academic Tutoring",
        children: [
            {
                name: "Mathematics",
                children: ["Algebra", "Geometry", "Calculus", "Trigonometry", "Statistics"]
            },
            {
                name: "Science",
                children: ["Biology", "Chemistry", "Physics", "Environmental Science", "Anatomy & Physiology"]
            },
            {
                name: "English & Literature",
                children: ["Grammar", "Essay Writing", "Reading Comprehension", "Creative Writing", "AP English"]
            },
            {
                name: "History & Social Studies",
                children: ["World History", "U.S. History", "Civics & Government", "Geography", "Economics"]
            },
            {
                name: "Test Prep & College Readiness",
                children: ["SAT", "ACT", "AP Exams", "GED", "College Application Essays"]
            }
        ]
    },
    {
        name: "Skill Development",
        children: [
            {
                name: "Coding",
                children: ["Python", "Java", "C++", "JavaScript", "Swift", "App Development"]
            },
            {
                name: "Business & Entrepreneurship",
                children: ["Marketing", "Business Strategy", "Sales", "E-commerce", "Startups"]
            },
            {
                name: "Financial Literacy",
                children: ["Budgeting", "Investing", "Taxes", "Credit Management", "Wealth Building"]
            },
            {
                name: "Music & Arts",
                children: ["Instrumental Lessons", "Vocal Training", "Music Production", "Painting", "Drawing", "Digital Art"]
            },
            {
                name: "Public Speaking & Communication",
                children: ["Presentation Skills", "Storytelling", "Debate", "Speech Writing", "Persuasion"]
            }
        ]
    },
    {
        name: "Life Coaching",
        children: [
            {
                name: "Confidence Building",
                children: ["Boosting Self-Esteem", "Overcoming Self-Doubt", "Building Resilience", "Assertiveness"]
            },
            {
                name: "Emotional Intelligence",
                children: ["Managing Emotions", "Stress Reduction", "Self-Awareness", "Mindful Living"]
            },
            {
                name: "Productivity",
                children: ["Time Management", "Habit Formation", "Prioritization", "Motivation", "Actionable Goal Setting"]
            },
            {
                name: "Health & Wellness",
                children: ["Healthy Habits", "Nutrition & Lifestyle", "Stress Reduction", "Sleep Optimization"]
            },
            {
                name: "Weight Management",
                children: ["Sustainable Weight Loss", "Healthy Eating Habits", "Accountability Coaching", "Behavior Change"]
            },
            {
                name: "Burnout & Work-Life Balance",
                children: ["Burnout Recovery", "Boundary Setting", "Energy Management", "Work-Life Integration"]
            },
            {
                name: "Student Success & College Readiness",
                children: ["Study Skills", "Academic Goal Setting", "College Preparation", "Time Management"]
            },
            {
                name: "Career Development & Transition",
                children: ["Career Planning", "Career Change", "Job Search Strategy", "Workplace Confidence"]
            },
            {
                name: "Relationship & Family",
                children: ["Healthy Communication", "Conflict Resolution", "Trust Building", "Parent-Child Communication", "Boundary Setting"]
            },
            {
                name: "Neurodiversity & Executive Function",
                children: ["ADHD Coaching", "Organization Skills", "Focus Strategies", "Time Management"]
            },
            {
                name: "NLP (Neuro-Linguistic Programming)",
                children: ["Limiting Belief Transformation", "Mindset Reframing", "Goal Achievement", "Confidence Building"]
            },
            {
                name: "Business",
                children: ["Entrepreneurship", "Business Strategy", "Leadership Development", "Personal Branding"]
            },
            {
                name: "Other",
                children: ["Other"]
            }
        ]
    }
];

async function main() {
    console.log('Seeding categories...');

    // Remove existing tutor-category links, then categories (delete leaves first, then parents)
    await prisma.tutorCategory.deleteMany({});
    let deleted = 1;
    while (deleted > 0) {
        const all = await prisma.category.findMany({ select: { id: true, parent_id: true } });
        const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean));
        const leaves = all.filter((c) => !parentIds.has(c.id));
        deleted = 0;
        for (const c of leaves) {
            await prisma.category.delete({ where: { id: c.id } });
            deleted++;
        }
    }
    console.log('Cleared existing categories.');

    for (const root of categories) {
        // Create Root Category
        const rootCat = await prisma.category.create({
            data: { name: root.name }
        });
        console.log(`Created root: ${root.name}`);

        if (root.children) {
            for (const sub of root.children) {
                // Create Sub Category
                const subCat = await prisma.category.create({
                    data: {
                        name: sub.name,
                        parent_id: rootCat.id
                    }
                });
                console.log(`  - Created sub: ${sub.name}`);

                if (sub.children) {
                    // Create Leaf Categories (Expertise)
                    await prisma.category.createMany({
                        data: sub.children.map(name => ({
                            name,
                            parent_id: subCat.id
                        }))
                    });
                    console.log(`    - Added ${sub.children.length} expertise areas`);
                }
            }
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
