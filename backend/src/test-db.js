import prisma from "./prisma.js";

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 AS result`;

  console.log("Database connection successful:", result);
}

main()
  .catch((error) => {
    console.error("Database connection failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });