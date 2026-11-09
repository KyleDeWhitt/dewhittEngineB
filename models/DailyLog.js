const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyLog = sequelize.define('DailyLog', {
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
    steps: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    waterGlasses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    activeMinutes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sleepHours: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    heartRateAvg: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    caloriesConsumed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    protein: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    carbs: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fat: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    weight: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    food: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    indexes: [
        { unique: true, fields: ['userId', 'date'] }
    ]
});

module.exports = DailyLog;