import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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

    // Credentials come from the environment so no default admin password exists anywhere
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword || adminPassword.length < 12) {
        throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) to create the first admin.');
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

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
            is_super_admin: true,
        },
    });

    console.log('✅ Admin profile created');
    console.log('\n⚠️  Remove SEED_ADMIN_PASSWORD from the environment now that the admin exists.\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
