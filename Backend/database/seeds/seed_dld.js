import { log } from "../../lib/utility.js";

// Sample directory data: categories with their links.
// Each category groups a few links. Used to bootstrap a fresh dev database.
const SEED_DATA = [
    {
        category: {
            name: "Internal Tools",
            description: "Day-to-day systems the team uses.",
            icon: "🛠️",
            color: "#2563eb",
            sort_order: 1,
        },
        links: [
            { title: "Admin Dashboard", url: "https://example.com/admin", description: "Internal operations dashboard.", sort_order: 1 },
            { title: "Ticketing", url: "https://example.com/tickets", description: "Support and issue tracking.", sort_order: 2 },
            { title: "Wiki", url: "https://example.com/wiki", description: "Team knowledge base.", sort_order: 3 },
        ],
    },
    {
        category: {
            name: "Documentation",
            description: "Guides, references, and runbooks.",
            icon: "📚",
            color: "#16a34a",
            sort_order: 2,
        },
        links: [
            { title: "API Reference", url: "https://example.com/docs/api", description: "REST API documentation.", sort_order: 1 },
            { title: "Onboarding Guide", url: "https://example.com/docs/onboarding", description: "Start-here guide for new members.", sort_order: 2 },
        ],
    },
    {
        category: {
            name: "External",
            description: "Public-facing and third-party sites.",
            icon: "🌐",
            color: "#db2777",
            sort_order: 3,
        },
        links: [
            { title: "Company Site", url: "https://example.com", description: "Public marketing website.", sort_order: 1 },
            { title: "Status Page", url: "https://status.example.com", description: "Live service status.", sort_order: 2 },
        ],
    },
];

export default async function seedDld(db, options = {}) {
    if (!db?.Categories || !db?.Links) {
        return;
    }

    const forceSync = options.forceSync === true;

    // Only seed when the directory is empty, unless a force sync is requested.
    const existingCount = await db.Categories.count();
    if (existingCount > 0 && !forceSync) {
        await log(`seed_dld skipped (found ${existingCount} existing categories)`, import.meta.url);
        return;
    }

    if (forceSync) {
        await db.Links.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
        await db.Categories.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
    }

    let categoryCount = 0;
    let linkCount = 0;

    for (const entry of SEED_DATA) {
        const category = await db.Categories.create(entry.category);
        categoryCount += 1;

        for (const link of entry.links) {
            await db.Links.create({ ...link, category_id: category.uuid });
            linkCount += 1;
        }
    }

    await log(`seed_dld created ${categoryCount} categories and ${linkCount} links`, import.meta.url);
}
