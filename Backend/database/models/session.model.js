export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "Sessions",
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
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                comment: "FK to users.uuid that owns this session",
            },
            token: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: "Opaque bearer token presented by the client",
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "When this session token stops being valid",
            },
        },
        {
            tableName: "sessions",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.session || {},
        },
    );
};
