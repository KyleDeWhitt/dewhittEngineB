require('dotenv').config();
const { sequelize } = require('./config/database');

const fixRemoteDB = async () => {
    try {
        console.log('🔌 Connecting to REMOTE Hostinger Database...');
        await sequelize.authenticate();
        console.log('✅ Connected.');

        console.log('⚠️ Dropping Users table to clear "Too many keys" error...');
        
        // Disable foreign key checks to ensure the drop works even if there are relations
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.query('DROP TABLE IF EXISTS Users');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Users table dropped successfully.');
        console.log('🎉 You can now restart your server to rebuild it cleanly.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error fixing remote database:', error);
        process.exit(1);
    }
};

fixRemoteDB();