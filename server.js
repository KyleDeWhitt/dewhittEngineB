// server.js
require('dotenv').config(); 

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

// --- Database Imports ---
const { connectDB, sequelize } = require('./config/database'); 
const User = require('./models/User.js');  
const Goal = require('./models/Goal.js'); 
const Log = require('./models/Log.js');    
const { protect } = require('./middleware/auth'); 

const goalRoutes = require('./routes/goalRoutes'); 
const logRoutes = require('./routes/logRoutes');
const userRoutes = require('./routes/userRoutes'); 
            
const app = express();
const PORT = process.env.PORT || 3000; 

// ------------------------------------------------------------------
// --- 1. SECURITY MIDDLEWARE ---
// ------------------------------------------------------------------
app.set('trust proxy', 1); // 1. 👇 ADDED: Fixes Render Rate Limit Warning
app.use(helmet());

app.use(cors({
    origin: ['http://localhost:5173', 'https://shiny-croquembouche-2237d6.netlify.app'],
    credentials: true
}));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 100, 
    message: { success: false, message: "Too many requests, please try again later." }
});
app.use(limiter);

// ------------------------------------------------------------------
// --- 2. ⚡ STRIPE WEBHOOK (MUST BE BEFORE express.json) ---
// ------------------------------------------------------------------
// 2. 👇 ADDED: The Listener for Stripe Payments
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`⚠️ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;

        console.log(`💰 Payment success! Upgrading User ID: ${userId}`);

        try {
            await User.update({
                subscriptionStatus: 'active',
                planTier: 'premium',
                stripeCustomerId: session.customer
            }, {
                where: { id: userId }
            });
            console.log('✅ User upgraded successfully.');
        } catch (dbError) {
            console.error('❌ Database update failed inside webhook:', dbError);
        }
    }

    res.send();
});

// ------------------------------------------------------------------
// --- 3. STANDARD MIDDLEWARE (MOVED HERE) ---
// ------------------------------------------------------------------
app.use(express.json()); // <--- 3. 👇 CORRECTED: Now runs AFTER webhook

// ------------------------------------------------------------------
// --- 4. APP ROUTES ---
// ------------------------------------------------------------------

// Registration
app.post('/register', async (req, res, next) => { 
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
            email, password: hashedPassword, first_name, last_name, role: role || 'Member'
        });
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.status(201).json({ 
            success: true, message: 'User registered successfully!', token, 
            user: { id: newUser.id, name: `${newUser.first_name} ${newUser.last_name}`, role: newUser.role }
        });
    } catch (error) { next(error); }
});

// Login
app.post('/login', async (req, res, next) => { 
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required.' });
        }
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        // 4. 👇 UPDATED: Return plan info on login
        return res.json({ 
            success: true, message: 'Login successful!', token, 
            user: { 
                id: user.id, 
                name: `${user.first_name} ${user.last_name}`, 
                role: user.role,
                planTier: user.planTier 
            } 
        });
    } catch (error) { next(error); }
});

// Stripe Checkout Session
app.post('/api/create-checkout-session', protect, async (req, res, next) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{ price: 'price_1SYpvSFPtgePKWbHVDFIdjxa', quantity: 1 }], 
            success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
            cancel_url: `${process.env.CLIENT_URL}/dashboard?canceled=true`,
            customer_email: req.user.email,
            metadata: { userId: req.user.id }
        });
        res.json({ url: session.url });
    } catch (error) { next(error); }
});

// Feature Routes
app.use('/api/goals', goalRoutes); 
app.use('/api/logs', logRoutes); 
app.use('/api/user', userRoutes); 

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Catch:', err.stack); 
    res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
});

// Start Server
const startServer = async () => {
    try {
        await connectDB(); 
        if (sequelize) {
            await sequelize.sync({ alter: true });
            console.log('✅ Database tables updated successfully!');
        }
        app.listen(PORT, () => {
            console.log(`\nServer running securely on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('\n!!! Server failed to start:', e.message);
    }
};

startServer();