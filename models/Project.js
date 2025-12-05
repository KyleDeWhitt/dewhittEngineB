const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // The name of their website/app
    name: {
        type: DataTypes.STRING, 
        defaultValue: 'New DeWhitt Project'
    },
    // The status shown on their dashboard (e.g., "Development", "Live")
    status: {
        type: DataTypes.STRING, 
        defaultValue: 'Onboarding'
    },
    // Progress bar (0-100)
    progress: {
        type: DataTypes.INTEGER, 
        defaultValue: 0
    },
    // When they pay next
    nextInvoiceDate: {
        type: DataTypes.STRING, 
        defaultValue: 'TBD'
    },
    // How much they pay
    subscriptionAmount: {
        type: DataTypes.INTEGER, 
        defaultValue: 0
    }
});

module.exports = Project;