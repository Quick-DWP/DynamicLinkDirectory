export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "Users",
        {
            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false,
                comment: "Primary key of the table",
            },
            rolling_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                allowNull: false,
                unique: true,
                comment: "Auto-incrementing secondary key (a good index; not the primary key)",
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: "Login name (unique)",
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Email used to match Microsoft (Azure AD) sign-in; case-insensitive",
            },
            display_name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "",
                comment: "Human-friendly name shown in the UI",
            },
            password_hash: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "scrypt hash of the password (hex); null for Microsoft-only accounts",
            },
            password_salt: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Per-password salt (hex); null for Microsoft-only accounts",
            },
            role: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "admin",
                comment: "Role of the user; admin can manage the directory",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "When false the account cannot log in",
            },
            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Timestamp of the most recent successful login",
            },
        },
        {
            tableName: "users",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.user || {},
            defaultScope: {
                // Never leak credentials by default.
                attributes: { exclude: ["password_hash", "password_salt"] },
            },
            scopes: {
                withSecret: {},
            },
        },
    );
};
