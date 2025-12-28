require('dotenv').config(); // 👈 Load Environment Variables First!
const { sequelize } = require('./config/database');
const User = require('./models/User');
const Project = require('./models/Project');

const clearDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('🔌 Connected to Database.');

        // Delete all projects first (due to foreign key constraints)
        // 'truncate: false' uses DELETE FROM which is safer for foreign keys than TRUNCATE
        await Project.destroy({ where: {}, truncate: false });
        console.log('✅ Projects cleared.');

        // Delete all users
        await User.destroy({ where: {}, truncate: false });
        console.log('✅ Users cleared.');

        console.log('🎉 Database Cleaned Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        process.exit(1);
    }
};

clearDatabase();