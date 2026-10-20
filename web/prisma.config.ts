import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Not needed for `prisma generate`, so don't fail when it is unset (e.g. in the nix build).
    url: process.env.DATABASE_URL ?? "",
  },
});
