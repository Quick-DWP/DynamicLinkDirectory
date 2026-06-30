export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "Links",
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
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Display title of the link",
            },
            url: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: "Destination URL the link points to",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "",
                comment: "Optional short description shown under the link title",
            },
            icon: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Optional emoji or short label used as the link icon",
            },
            category_id: {
                type: DataTypes.UUID,
                allowNull: true,
                comment: "FK to categories.uuid; null means uncategorized",
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Manual ordering of links within a group (ascending)",
            },
            click_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Number of times this link was opened from the public directory",
            },
            open_in_new_tab: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "Whether the public directory opens this link in a new tab",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "When false the link is hidden from the public directory",
            },
        },
        {
            tableName: "links",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.link || {},
        },
    );
};
