import { log } from "../lib/utility.js";

// Idempotent, additive schema patches.
//
// We keep Sequelize's `sync.alter` disabled because this Postgres trips a
// describeTable bug (see AI_CarryOn.md). `sync` still creates brand-new tables,
// but it will NOT add new columns to tables that already exist. This step fills
// that gap with explicit `ADD COLUMN IF NOT EXISTS` statements that are safe to
// run on every boot.
export default async function applySchemaPatches(sequelize, schemas) {
    const schema = schemas.project;
    const statements = [
        `ALTER TABLE "${schema}"."links" ADD COLUMN IF NOT EXISTS "click_count" INTEGER NOT NULL DEFAULT 0;`,
        `ALTER TABLE "${schema}"."links" ADD COLUMN IF NOT EXISTS "open_in_new_tab" BOOLEAN NOT NULL DEFAULT true;`,
        `ALTER TABLE "${schema}"."categories" ADD COLUMN IF NOT EXISTS "default_expanded" BOOLEAN NOT NULL DEFAULT false;`,
    ];

    for (const sql of statements) {
        await sequelize.query(sql);
    }

    await log(`applySchemaPatches ran ${statements.length} additive patch(es)`, import.meta.url);
}
