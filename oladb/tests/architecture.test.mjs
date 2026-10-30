import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("database credentials stay on the server and no unsafe raw SQL is used", async () => {
  const [database, schema, tables, dashboard] = await Promise.all([
    source("lib/db.ts"),
    source("prisma/schema.prisma"),
    source("lib/tables.ts"),
    source("app/dashboard/dashboard-client.tsx"),
  ]);

  assert.match(database, /new PrismaClient/);
  assert.match(schema, /url\s*=\s*env\("DATABASE_URL"\)/);
  assert.equal(/queryRawUnsafe|executeRawUnsafe|\$executeRaw/.test(tables), false);
  assert.equal(/DATABASE_URL=|postgres(?:ql)?:\/\//i.test(dashboard), false);
});

test("only the approved fictional KelvJessia models are exposed to the table editor", async () => {
  const [tables, tableRoute] = await Promise.all([
    source("lib/tables.ts"),
    source("app/api/projects/[projectId]/tables/[table]/route.ts"),
  ]);
  for (const model of ["vehicles", "trips", "bookings", "booking_status_history"]) {
    assert.match(tables, new RegExp(`\\b${model}\\b`));
  }
  assert.match(tableRoute, /tableName\.parse\(table\)/);
  assert.match(tables, /Status history is immutable/);
});

test("all protected REST handlers enforce administrator authentication", async () => {
  const files = [
    "app/api/health/route.ts",
    "app/api/projects/route.ts",
    "app/api/projects/[projectId]/route.ts",
    "app/api/projects/[projectId]/tables/[table]/route.ts",
    "app/api/projects/[projectId]/tables/[table]/[recordId]/route.ts",
  ];
  for (const file of files) {
    assert.match(await source(file), /requireApiAdministrator/);
  }
});
