// models/User.js (UPDATED with Profile Metrics)

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database'); 

const User = sequelize.define('User', {
    // Core Identity Fields
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('Member', 'Admin'),
        defaultValue: 'Member',
        allowNull: false,
    },
    
    // 🆕 New Profile Metrics Fields
    height: {
        type: DataTypes.INTEGER, // Stored in inches or cm, based on front-end conversion
        allowNull: true,
    },
    currentWeight: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    goalWeight: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    unit: {
        type: DataTypes.ENUM('lbs', 'kg'),
        allowNull: true,
    },
}, {
    // Ensure timestamps are disabled if you don't use them
    timestamps: false, 
});

module.exports = User;