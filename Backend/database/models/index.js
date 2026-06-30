import { DataTypes } from "sequelize";
import logMessageModel from "./log_message.model.js";
import logRequestModel from "./log_request.model.js";
import categoryModel from "./category.model.js";
import linkModel from "./link.model.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import settingModel from "./setting.model.js";

export default function initModels(sequelize, schema) {
    const choices = {
        log_messages_level: ["info", "warning", "error"],
    };

    const hooks = {
        // category: {
        //     beforeSave(instance) {
        //         XXX
        //     },
        // },
    };

    const LogMessages = logMessageModel(sequelize, DataTypes, schema, choices, hooks);
    const LogRequests = logRequestModel(sequelize, DataTypes, schema, choices, hooks);
    const Categories = categoryModel(sequelize, DataTypes, schema, choices, hooks);
    const Links = linkModel(sequelize, DataTypes, schema, choices, hooks);
    const Users = userModel(sequelize, DataTypes, schema, choices, hooks);
    const Sessions = sessionModel(sequelize, DataTypes, schema, choices, hooks);
    const Settings = settingModel(sequelize, DataTypes, schema, choices, hooks);

    // Associations
    Categories.hasMany(Links, {
        foreignKey: "category_id",
        as: "links",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
    });
    Links.belongsTo(Categories, {
        foreignKey: "category_id",
        as: "category",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
    });

    Users.hasMany(Sessions, {
        foreignKey: "user_id",
        as: "sessions",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
    });
    Sessions.belongsTo(Users, {
        foreignKey: "user_id",
        as: "user",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
    });

    return {
        models: {
            LogMessages,
            LogRequests,
            Categories,
            Links,
            Users,
            Sessions,
            Settings,
        },
        choices,
    };
}
