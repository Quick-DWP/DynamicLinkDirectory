import { log } from "../../lib/utility.js";
import { hashPassword } from "../../lib/auth.js";

// Ensure at least one admin account exists so the directory can be managed.
// Credentials come from config.auth.default_admin, with safe fallbacks.
export default async function seedAdminUser(db, options = {}) {
    if (!db?.Users) {
        return;
    }

    const existing = await db.Users.count();
    if (existing > 0) {
        await log(`seed_admin_user skipped (found ${existing} existing user(s))`, import.meta.url);
        return;
    }

    const username = String(options.username || "admin").trim();
    const password = String(options.password || "admin123");
    const displayName = String(options.display_name || "Administrator").trim();

    const { hash, salt } = hashPassword(password);
    await db.Users.create({
        username,
        display_name: displayName,
        password_hash: hash,
        password_salt: salt,
        role: "admin",
        is_active: true,
    });

    await log(`seed_admin_user created default admin "${username}" (change the password after first login)`, import.meta.url);
}
