import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestTutor() {
    const tutor = await prisma.tutorProfile.findFirst({
        // Assuming created_at exists on TutorProfile is implicit via relation or migration, wait, TutorProfile doesn't have created_at in schema shown earlier? 
        // Let's check schema/view_file. 
        // User table has created_at. TutorProfile updates might not change created_at of user.
        // Let's find by last updated or just list all.
        include: { user: true }
    });

    // Actually, let's just list the last 5 users with tutor profiles
    const tutors = await prisma.tutorProfile.findMany({
        take: 5,
        include: { user: true }
    });

    console.log(JSON.stringify(tutors, null, 2));
}

checkLatestTutor()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
