// config/database.js

const { Sequelize } = require('sequelize');

// The environment variables (like DB_HOST, etc.) are loaded at the top of server.js

// ----------------------------------------------------------------------
// 1. Define and Export the Sequelize Instance Immediately
// ----------------------------------------------------------------------
const sequelize = new Sequelize(
    // Database Name
    process.env.DB_NAME,     
    // Database User
    process.env.DB_USER,   
    // Database Password
    process.env.DB_PASSWORD, 
    {
        host: process.env.DB_HOST,
        dialect: 'mysql', 
        logging: false, 
        dialectOptions: { 
            connectTimeout: 60000 
        }
    }
);

// ----------------------------------------------------------------------
// 2. Define Connection Logic
// ----------------------------------------------------------------------
const connectDB = async () => {
    try {
        // Authenticate the connection
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        // Using { alter: true } for non-destructive schema changes during development
        // This will update tables without dropping data.
        await sequelize.sync({ alter: true }); 
        
        // Corrected log message to reflect synchronization, not dropping
        console.log('Database synchronization complete. Tables updated, data preserved.');

    } catch (error) {
        console.error('Unable to connect to the database:', error);
        // Rethrow the error so server.js can handle the failure
        throw error; 
    }
};

// ----------------------------------------------------------------------
// 3. Export both the instance and the connection function
// ----------------------------------------------------------------------
module.exports = { sequelize, connectDB };