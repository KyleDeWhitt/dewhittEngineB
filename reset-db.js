// reset-db.js
require('dotenv').config();
const db = require('./config/database');
const sequelize = db.sequelize || db; 

// Import models so Sequelize knows what to build back up
const User = require('./models/User'); 
// Add any other models you have if you want them rebuilt immediately, 
// otherwise they will rebuild when the server starts.

const reset = async () => {
  try {
    console.log('⚠️  CONNECTING TO DATABASE...');
    await sequelize.authenticate();
    
    console.log('🔓  DISABLING FOREIGN KEY CHECKS...');
    // This tells MySQL to ignore relationships so we can delete freely
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });

    console.log('💣  DROPPING ALL TABLES (Fixing "Too Many Keys")...');
    await sequelize.sync({ force: true });

    console.log('🔒  RE-ENABLING FOREIGN KEY CHECKS...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
    
    console.log('✅  DATABASE WIPED & CLEANED. ZOMBIE INDEXES ARE DEAD.');
    process.exit(0);
  } catch (err) {
    console.error('❌  Reset Failed:', err);
    process.exit(1);
  }
};

reset();