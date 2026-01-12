
import { PrismaClient, Role, TutorTier, BookingFrequency } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TUTOR_NAMES = [
    "James Smith", "Maria Garcia", "David Johnson", "Sarah Williams", "Michael Brown",
    "Jennifer Davis", "Robert Miller", "Elizabeth Wilson", "William Moore", "Linda Taylor"
];

const STUDENT_NAMES = [
    "Christopher Jones", "Patricia White", "Matthew Martin", "Barbara Thompson", "Joseph Anderson",
    "Nancy Clark", "Thomas Rodriguez", "Margaret Lewis", "Charles Walker", "Lisa Hall"
];

const SUBJECTS = [
    "Mathematics", "Physics", "Chemistry", "Biology", "English Literature",
    "History", "Computer Science", "Spanish", "Piano", "Public Speaking"
];

const PLACES = ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ"];

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
    console.log("🌱 Starting seeding...");

    // Password hash (password123)
    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Fetch Categories for assignment
    const categories = await prisma.category.findMany();
    // 2. Create Tutors
    const assignableCategories = categories.filter(c => c.parent_id !== null);

    const createdTutors = [];
    console.log("Creating Tutors...");

    for (let i = 0; i < TUTOR_NAMES.length; i++) {
        const fullName = TUTOR_NAMES[i];
        const firstName = fullName.split(' ')[0];
        const email = `tutor${i + 1}@example.com`; // Deterministic emails

        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password_hash: passwordHash,
                role: Role.TUTOR,
                is_verified: true,
            }
        });

        // Create Profile
        const profile = await prisma.tutorProfile.upsert({
            where: { user_id: user.id },
            update: {},
            create: {
                user_id: user.id,
                username: fullName,
                tagline: `Expert ${getRandomItem(SUBJECTS)} Tutor`,
                about: `Hi, I'm ${firstName}. I have over ${getRandomInt(3, 15)} years of experience teaching students of all levels. I specialize in making complex topics easy to understand.`,
                hourly_rate: getRandomInt(30, 100),
                experience_years: getRandomInt(3, 15),
                country: "USA", // Enforce American
                timezone: "America/New_York",
                is_verified: true,
                tier: getRandomItem([TutorTier.PRO, TutorTier.PREMIUM]),
                rating: getRandomInt(40, 50) / 10, // 4.0 - 5.0
                review_count: getRandomInt(5, 50),
                total_students: getRandomInt(10, 100),
            }
        });

        createdTutors.push(profile);

        // Assign Categories (3 random ones)
        if (assignableCategories.length > 0) {
            await prisma.tutorCategory.deleteMany({ where: { tutor_id: profile.id } });
            const selectedCats = new Set<string>();
            while (selectedCats.size < 3) {
                const cat = getRandomItem(assignableCategories);
                selectedCats.add(cat.id);
            }

            for (const catId of selectedCats) {
                await prisma.tutorCategory.create({
                    data: { tutor_id: profile.id, category_id: catId }
                }).catch(() => { }); // Ignore dupes if set logic fails
            }
        }

        // Add Availability (M-F, 9-5)
        // Only if none exist
        const count = await prisma.availability.count({ where: { tutor_id: profile.id } });
        if (count === 0) {
            const availabilities = [];
            for (let day = 1; day <= 5; day++) { // Mon-Fri
                availabilities.push({
                    tutor_id: profile.id,
                    day_of_week: day,
                    start_time: "09:00",
                    end_time: "17:00"
                });
            }
            await prisma.availability.createMany({ data: availabilities });
        }
    }

    // 3. Create Students
    const createdStudents = [];
    console.log("Creating Students...");

    for (let i = 0; i < STUDENT_NAMES.length; i++) {
        const fullName = STUDENT_NAMES[i];
        const email = `student${i + 1}@example.com`;

        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password_hash: passwordHash,
                role: Role.STUDENT,
                is_verified: true,
            }
        });

        const profile = await prisma.studentProfile.upsert({
            where: { user_id: user.id },
            update: {},
            create: {
                user_id: user.id,
                username: fullName,
                grade_level: getRandomItem(["K-12", "College", "Adult"]),
            }
        });
        createdStudents.push(profile);
    }

    // 4. Create Bookings
    console.log("Creating Bookings...");

    // Check if bookings exist, if so skip so we don't overpopulate on re-runs
    const bookingCount = await prisma.booking.count();
    if (bookingCount < 50) {
        for (let i = 0; i < 20; i++) {
            const tutor = getRandomItem(createdTutors);
            const student = getRandomItem(createdStudents);

            // Random date in next 2 weeks
            const now = new Date();
            const start = new Date(now.getTime() + getRandomInt(1, 14) * 24 * 60 * 60 * 1000); // 1-14 days future
            start.setHours(getRandomInt(9, 16), 0, 0, 0); // 9am - 4pm
            const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

            const booking = await prisma.booking.create({
                data: {
                    tutor_id: tutor.id,
                    student_id: student.id,
                    start_date: start,
                    end_date: end,
                    status: "CONFIRMED",
                    frequency: BookingFrequency.ONCE,
                }
            });

            // Create Lesson
            await prisma.lesson.create({
                data: {
                    tutor_id: tutor.id,
                    student_id: student.id,
                    booking_id: booking.id,
                    start_time: start,
                    end_time: end,
                    duration: 60,
                    status: "PENDING",
                    meeting_link: `https://meet.google.com/abc-defg-hij`,
                }
            });
        }
    }

    console.log("✅ Seeding complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
