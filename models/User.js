// models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'Member'
    },
    // --- 💰 NEW MEMBERSHIP FIELDS ---
    subscriptionStatus: {
        type: DataTypes.ENUM('active', 'inactive', 'past_due', 'canceled'),
        defaultValue: 'inactive'
    },
    planTier: {
        type: DataTypes.ENUM('free', 'premium'),
        defaultValue: 'free'
    },
    stripeCustomerId: {
        type: DataTypes.STRING,
        allowNull: true // Will be null until they checkout
    },
    currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true // When their current month expires
    },

    // --- 🏋️ FITNESS PROFILE FIELDS ---
    height: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    currentWeight: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    goalWeight: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    startWeight: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    unit: {
        type: DataTypes.ENUM('imperial', 'metric'),
        defaultValue: 'imperial'
    },
    gender: {
        type: DataTypes.ENUM('male', 'female'),
        allowNull: true
    },
    age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    activityLevel: {
        type: DataTypes.ENUM('sedentary', 'light', 'moderate', 'active', 'very'),
        defaultValue: 'moderate'
    },
    goalType: {
        type: DataTypes.ENUM('lose', 'build', 'maintain', 'endurance'),
        defaultValue: 'build'
    }
});

module.exports = User;