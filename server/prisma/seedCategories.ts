import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
    {
        name: "Academic Success",
        children: [
            {
                name: "Mathematics",
                children: ["Algebra", "Geometry", "Calculus", "Statistics", "Trigonometry", "Arithmetic", "Pre-Calculus"]
            },
            {
                name: "Language Arts",
                children: ["Reading Comprehension", "Writing Skills", "Grammar", "Literature", "Creative Writing", "English as Second Language (ESL)"]
            },
            {
                name: "Science",
                children: ["Biology", "Chemistry", "Physics", "Environmental Science", "General Science"]
            },
            {
                name: "Test Preparation",
                children: ["SAT", "ACT", "GRE", "GMAT", "TOEFL", "IELTS", "GED"]
            },
            {
                name: "Social Studies",
                children: ["History", "Geography", "Economics", "Psychology", "Sociology"]
            }
        ]
    },
    {
        name: "Skill Development",
        children: [
            {
                name: "Programming & Technology",
                children: ["Python", "JavaScript", "HTML/CSS", "Web Development", "Data Science", "Cybersecurity", "Mobile App Dev"]
            },
            {
                name: "Business & Marketing",
                children: ["Digital Marketing", "Content Writing", "Entrepreneurship", "Social Media Management", "SEO"]
            },
            {
                name: "Creative Arts",
                children: ["Painting", "Drawing", "Digital Art", "Photography", "Graphic Design"]
            },
            {
                name: "Music",
                children: ["Guitar", "Piano", "Vocals", "Music Theory", "Music Production"]
            },
            {
                name: "Life Skills",
                children: ["Financial Literacy", "Public Speaking", "Cooking", "Driving Theory"]
            }
        ]
    },
    {
        name: "Personal Growth",
        children: [
            {
                name: "Personal Development",
                children: ["Time Management", "Goal Setting", "Self-Motivation", "Confidence Building", "Productivity"]
            },
            {
                name: "Emotional Intelligence",
                children: ["Stress Management", "Resilience", "Mindfulness", "Communication Skills", "Empathy"]
            },
            {
                name: "Career Coaching",
                children: ["Resume Writing", "Interview Preparation", "Career Planning", "Leadership Skills", "Negotiation"]
            }
        ]
    }
];

async function main() {
    console.log('Seeding categories...');

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
