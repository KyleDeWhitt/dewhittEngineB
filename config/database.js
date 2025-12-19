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
            // 👇 CRITICAL SECURITY FIX FOR PRODUCTION 👇
            ssl: {
                require: true, 
                rejectUnauthorized: false // This is usually required for Hostinger/Shared hosting
            }
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
        
        // ⚠️ NOTE: In a massive scale app, we would use 'Migrations' instead of alter:true.
        // But for your MVP launch, this is acceptable and much easier to manage.
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