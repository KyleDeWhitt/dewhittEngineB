require('dotenv').config(); 

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const cors = require('cors'); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const jwt = require('jsonwebtoken'); 

// --- Database Imports ---
const { connectDB, sequelize } = require('./config/database'); 
const User = require('./models/User.js');  
const Project = require('./models/Project.js');

const { protect } = require('./middleware/auth'); 
const userRoutes = require('./routes/userRoutes'); 
const adminRoutes = require('./routes/adminRoutes');
// 👇 NEW IMPORT
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000; 

// ------------------------------------------------------------------
// --- 1. SECURITY MIDDLEWARE ---
// ------------------------------------------------------------------
app.set('trust proxy', 1); 
app.use(helmet());

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173', 
        'https://shiny-croquembouche-2237d6.netlify.app',
        'https://dewhittdesigns.com',
        'https://www.dewhittdesigns.com',
        process.env.CLIENT_URL 
    ],
    credentials: true
}));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 100, 
    message: { success: false, message: "Too many requests, please try again later." }
});
app.use(limiter);

// ------------------------------------------------------------------
// --- 2. DATABASE ASSOCIATIONS ---
// ------------------------------------------------------------------
User.hasOne(Project, { foreignKey: 'userId', onDelete: 'CASCADE' });
Project.belongsTo(User, { foreignKey: 'userId' });

// ------------------------------------------------------------------
// --- 3. STRIPE WEBHOOK ---
// ------------------------------------------------------------------
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
            }, { where: { id: userId } });
            console.log('✅ User upgraded successfully.');
            // Respond to Stripe that we received the event
            res.status(200).send();
        } catch (dbError) {
            console.error('❌ Database update failed inside webhook:', dbError);
            // Crucially, send a non-200 response to Stripe so it retries
            return res.status(500).send('Database update failed.');
        }
    } else {
        // Handle other event types or ignore
        res.status(200).send();
    }
});

// ------------------------------------------------------------------
// --- 4. STANDARD MIDDLEWARE ---
// ------------------------------------------------------------------
app.use(express.json());

// ------------------------------------------------------------------
// --- 5. APP ROUTES ---
// ------------------------------------------------------------------

// 👇 NEW: Auth Routes (Login, Register, Verify Email)
app.use('/api/auth', authRoutes);

// Stripe Checkout Session
app.post('/api/create-checkout-session', protect, async (req, res, next) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [
                {
                    price: 'price_1SYpvSFPtgePKWbHVDFIdjxa', 
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
            cancel_url: `${process.env.CLIENT_URL}/dashboard?canceled=true`,
            customer_email: req.user.email,
            metadata: { userId: req.user.id }
        });

        res.json({ url: session.url });
    } catch (error) {
        next(error); 
    }
});

// Client Dashboard Data
app.get('/api/my-project', protect, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { userId: req.user.id } });
        if (!project) {
            return res.status(404).json({ message: 'No project found.' });
        }
        res.json(project);
    } catch (err) {
        console.error("Project Fetch Error:", err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Standard Routes
app.use('/api/user', userRoutes); 
app.use('/api/admin', adminRoutes); 

// ------------------------------------------------------------------
// --- GLOBAL ERROR HANDLER ---
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Catch:', err.stack); 
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong on the server.' 
    });
});

// ------------------------------------------------------------------
// --- START SERVER ---
// ------------------------------------------------------------------
const startServer = async () => {
    try {
        await connectDB(); 

        if (sequelize) {
            await sequelize.authenticate();
            console.log('✅ Agency Database Ready! (Connection verified)');
        }

        app.listen(PORT, () => {
            console.log(`\nServer running securely on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('\n!!! Server failed to start:', e.message);
    }
};

startServer();