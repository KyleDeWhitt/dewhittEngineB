// config/database.js

const { Sequelize } = require('sequelize');

// The environment variables (like DB_HOST, etc.) are loaded at the top of server.js

// ----------------------------------------------------------------------
// 1. Define and Export the Sequelize Instance Immediately
// ----------------------------------------------------------------------
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false,
        dialectOptions: {
            connectTimeout: 60000,
        }
    }
);

// ----------------------------------------------------------------------
// 2. Define Connection Logic
// ----------------------------------------------------------------------
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        await sequelize.sync({ alter: true });
        
        console.log('Database synchronization complete. Tables updated, data preserved.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
};

// ----------------------------------------------------------------------
// 3. Export both the instance and the connection function
// ----------------------------------------------------------------------
module.exports = { sequelize, connectDB };
