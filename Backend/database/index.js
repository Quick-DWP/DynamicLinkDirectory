import { Sequelize } from "sequelize";
import { loadConfig, log, logQuery } from "../lib/utility.js";

const config = loadConfig();

import initModels from "./models/index.js";
import applySchemaPatches from "./patches.js";
import seedDld from "./seeds/seed_dld.js";
import seedAdminUser from "./seeds/seed_admin_user.js";

const dbConfig = config.database.connection;

export async function initDB() {
    const sequelizeLoggingConfig = config.logging?.sequelize || {};
    
    // Create logging function for Sequelize
    const loggingFunction = (sequelizeLoggingConfig.log_to_file || 
                            sequelizeLoggingConfig.log_to_console) 
        ? (query, duration) => {
            logQuery(query, duration);
        }
        : false;

    const sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
            host: dbConfig.host,
            port: dbConfig.port || 5432,
            dialect: dbConfig.dialect,
            benchmark: sequelizeLoggingConfig.benchmark !== false,
            logging: loggingFunction
        },
    );

    await sequelize.authenticate();
    try {
        await sequelize.createSchema(dbConfig.schemas.project);
    } catch (err) {
        if (err.name !== "SequelizeDatabaseError") {
            throw err;
        }
    }
    const models = initModels(sequelize, dbConfig.schemas);

    await sequelize.sync(config.database.sync);
    await applySchemaPatches(sequelize, dbConfig.schemas);

    const db = {
        sequelize,
        ...models.models,
        choices: models.choices
    };

    await seedDld(db, {
        forceSync: config.database?.seed?.force_dld_sync === true,
    });

    await seedAdminUser(db, config.auth?.default_admin || {});

    return db;
}
