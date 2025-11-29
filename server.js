// server.js
require('dotenv').config(); 

const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet'); // <--- 1. Security Headers
const rateLimit = require('express-rate-limit'); // <--- 2. Rate Limiting
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

// --- Database Imports ---
const { connectDB } = require('./config/database'); 
const User = require('./models/User.js');  
const Goal = require('./models/Goal.js'); 
const Log = require('./models/Log.js');    

const goalRoutes = require('./routes/goalRoutes'); 
const logRoutes = require('./routes/logRoutes');
const userRoutes = require('./routes/userRoutes'); 
            
const app = express();
const PORT = process.env.PORT || 3000; 

// ------------------------------------------------------------------
// --- SECURITY MIDDLEWARE (The Bulletproof Layer) ---
// ------------------------------------------------------------------

// 1. Helmet: Hides tech stack and adds security headers
app.use(helmet());

// 2. CORS: Allow requests only from your specific domains
app.use(cors({
    origin: ['http://localhost:5173', 'https://shiny-croquembouche-2237d6.netlify.app'],
    credentials: true
}));

// 3. Rate Limiter: Prevent brute-force attacks (Limit: 100 requests per 15 min)
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
    message: { success: false, message: "Too many requests, please try again later." }
});
app.use(limiter);

// 4. Parse JSON bodies
app.use(express.json());


// ------------------------------------------------------------------
// --- DATABASE ASSOCIATIONS ---
// ------------------------------------------------------------------
User.hasMany(Goal, { foreignKey: 'userId', onDelete: 'CASCADE' });
Goal.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Log, { foreignKey: 'userId', onDelete: 'CASCADE' });
Log.belongsTo(User, { foreignKey: 'userId' });


// ------------------------------------------------------------------
// --- ROUTES ---
// ------------------------------------------------------------------

// Registration
app.post('/register', async (req, res, next) => { // Added 'next'
    try {
        const { email, password, first_name, last_name, role } = req.body;
        
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            email,
            password: hashedPassword,
            first_name,
            last_name,
            role: role || 'Member'
        });

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role },
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        return res.status(201).json({ 
            success: true, 
            message: 'User registered successfully!',
            token, 
            user: { 
                id: newUser.id,
                name: `${newUser.first_name} ${newUser.last_name}`,
                role: newUser.role
            }
        });

    } catch (error) {
        next(error); // Pass error to Global Error Handler
    }
});

// Login
app.post('/login', async (req, res, next) => { // Added 'next'
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required.' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        return res.json({ 
            success: true, 
            message: 'Login successful!',
            token, 
            user: { 
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                role: user.role 
            } 
        });

    } catch (error) {
        next(error); // Pass error to Global Error Handler
    }
});

// Feature Routes
app.use('/api/goals', goalRoutes); 
app.use('/api/logs', logRoutes); 
app.use('/api/user', userRoutes); 

// ------------------------------------------------------------------
// --- GLOBAL ERROR HANDLER (The Safety Net) ---
// ------------------------------------------------------------------
// This must be the LAST app.use()
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Catch:', err.stack); // Log the error for you
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong on the server. Please try again later.' 
    });
});

// ------------------------------------------------------------------
// --- START SERVER ---
// ------------------------------------------------------------------
const startServer = async () => {
    try {
        await connectDB(); 
        app.listen(PORT, () => {
            console.log(`\nServer running securely on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('\n!!! Server failed to start:', e.message);
    }
};

startServer();