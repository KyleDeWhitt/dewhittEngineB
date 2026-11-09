const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkoutLog = sequelize.define('WorkoutLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        defaultValue: 'Strength'
    },
    durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    caloriesBurned: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    sets: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    reps: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    load: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    notes: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = WorkoutLog;