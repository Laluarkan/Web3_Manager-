import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient agar koneksi database tidak terbuka berulang kali
export const prisma = new PrismaClient();
