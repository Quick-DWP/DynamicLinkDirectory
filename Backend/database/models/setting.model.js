export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "Settings",
        {
            key: {
                type: DataTypes.STRING,
                primaryKey: true,
                allowNull: false,
                comment: "Setting identifier (e.g. site_title)",
            },
            value: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "",
                comment: "Setting value (stored as text)",
            },
        },
        {
            tableName: "settings",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.setting || {},
        },
    );
};
