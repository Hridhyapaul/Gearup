import app from "./app.js";
import config from "./config/index.js";
import { prisma } from "./lib/prisma.js";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully");
    app.listen(PORT, () => {
      console.log(`GearUp server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log("Error connecting to database", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();
