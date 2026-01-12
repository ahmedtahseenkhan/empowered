"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
async function main() {
    console.log("--- DB TEST START ---");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    try {
        // Attempt 1: datasourceUrl
        console.log("Attempting initialization with datasourceUrl...");
        const prisma1 = new client_1.PrismaClient({
            datasourceUrl: process.env.DATABASE_URL,
        });
        await prisma1.$connect(); // Try to connect
        console.log("SUCCESS: Connected with datasourceUrl!");
        await prisma1.$disconnect();
        return;
    }
    catch (e) {
        console.error("FAILED with datasourceUrl:", e.message);
    }
    try {
        // Attempt 2: datasources.db.url
        console.log("Attempting initialization with datasources.db.url...");
        const prisma2 = new client_1.PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
        await prisma2.$connect();
        console.log("SUCCESS: Connected with datasources.db.url!");
        await prisma2.$disconnect();
    }
    catch (e) {
        console.error("FAILED with datasources.db.url:", e.message);
    }
}
main();
