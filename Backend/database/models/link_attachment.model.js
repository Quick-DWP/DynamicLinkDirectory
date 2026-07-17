export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "LinkAttachments",
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
            link_id: {
                type: DataTypes.UUID,
                allowNull: false,
                comment: "FK to links.uuid — the link this file is attached to",
            },
            filename: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Original file name shown to users",
            },
            mime_type: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "MIME type of the stored binary (e.g. application/pdf)",
            },
            size: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Size in bytes",
            },
            data: {
                type: DataTypes.BLOB("long"),
                allowNull: false,
                comment: "Raw file bytes (BYTEA in Postgres). Never returned in list endpoints.",
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Manual ordering of attachments within a link (ascending)",
            },
        },
        {
            tableName: "link_attachments",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.linkAttachment || {},
        },
    );
};
