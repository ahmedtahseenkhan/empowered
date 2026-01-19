import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
        console.log('✅ Admin user already exists');
        return;
    }

    // Create admin user
    const adminEmail = 'admin@empoweredlearnings.com';
    const adminPassword = 'admin123'; // Change this to a secure password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.create({
        data: {
            email: adminEmail,
            password_hash: hashedPassword,
            role: 'ADMIN',
            is_verified: true,
            is_suspended: false,
        },
    });

    console.log('✅ Admin user created:', adminEmail);

    // Create admin profile
    await prisma.adminProfile.create({
        data: {
            user_id: adminUser.id,
            username: 'Administrator',
        },
    });

    console.log('✅ Admin profile created');
    console.log('\n📧 Login credentials:');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('\n⚠️  Please change the password after first login!\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
