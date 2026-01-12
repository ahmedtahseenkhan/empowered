import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
    console.log("--- DB TEST START ---");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);

    try {
        // Attempt 1: datasourceUrl
        console.log("Attempting initialization with datasourceUrl...");
        const prisma1 = new PrismaClient({
            datasourceUrl: process.env.DATABASE_URL,
        } as any);
        await prisma1.$connect(); // Try to connect
        console.log("SUCCESS: Connected with datasourceUrl!");
        await prisma1.$disconnect();
        return;
    } catch (e: any) {
        console.error("FAILED with datasourceUrl:", e.message);
    }

    try {
        // Attempt 2: datasources.db.url
        console.log("Attempting initialization with datasources.db.url...");
        const prisma2 = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        } as any);
        await prisma2.$connect();
        console.log("SUCCESS: Connected with datasources.db.url!");
        await prisma2.$disconnect();
    } catch (e: any) {
        console.error("FAILED with datasources.db.url:", e.message);
    }
}

main();
