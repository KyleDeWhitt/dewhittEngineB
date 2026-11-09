const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FoodLog = sequelize.define('FoodLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    serving: {
        type: DataTypes.STRING,
        allowNull: true
    },
    calories: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    protein: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    carbs: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    fat: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    }
});

module.exports = FoodLog;