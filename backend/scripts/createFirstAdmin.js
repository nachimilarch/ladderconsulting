// One-time bootstrap for the very first admin account on a fresh database.
// Microsoft login never auto-creates hr_staff/admin accounts (by design —
// see CLAUDE.md "SSO Login"), so the first admin has to be inserted directly.
// After this, use that email to "Sign in with Microsoft", and from there on
// Admin → HR Staff Management can create everyone else normally.
//
// Usage: node scripts/createFirstAdmin.js "Full Name" "email@yourcompany.com"

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../src/config/db');

async function main() {
    const [name, email] = process.argv.slice(2);
    if (!name || !email) {
        console.error('Usage: node scripts/createFirstAdmin.js "Full Name" "email@yourcompany.com"');
        process.exit(1);
    }

    const [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
        console.error(`A user with email ${email} already exists (id ${existing.id}). Aborting.`);
        process.exit(1);
    }

    const [[roleRow]] = await db.query("SELECT id FROM roles WHERE name = 'admin'");
    if (!roleRow) {
        console.error("No 'admin' role found — has the schema/seed data been loaded?");
        process.exit(1);
    }

    const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
    const [result] = await db.query(
        `INSERT INTO users (role_id, name, email, password, status, is_email_verified)
         VALUES (?, ?, ?, ?, 'active', 1)`,
        [roleRow.id, name, email, randomHash]
    );

    console.log(`Admin user created (id ${result.insertId}).`);
    console.log(`Sign in with Microsoft using this exact email: ${email}`);
    process.exit(0);
}

main().catch(err => {
    console.error('Failed to create admin:', err);
    process.exit(1);
});
