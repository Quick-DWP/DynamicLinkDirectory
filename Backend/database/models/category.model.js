export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "Categories",
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
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Display name of the category / link group",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "",
                comment: "Optional short description shown under the group title",
            },
            icon: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Optional emoji or short label used as the group icon",
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Optional accent color (hex) for the group, e.g. #2563eb",
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Manual ordering of groups (ascending)",
            },
            default_expanded: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Whether this group starts expanded on the public directory",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "When false the group is hidden from the public directory",
            },
        },
        {
            tableName: "categories",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.category || {},
        },
    );
};
