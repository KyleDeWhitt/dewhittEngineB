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
const Project = require('./models/Project.js');

const { protect } = require('./middleware/auth'); 
const userRoutes = require('./routes/userRoutes'); 
const adminRoutes = require('./routes/adminRoutes');
            
const app = express();
const PORT = process.env.PORT || 3000; 

// ------------------------------------------------------------------
// --- 1. SECURITY MIDDLEWARE ---
// ------------------------------------------------------------------
app.set('trust proxy', 1); 
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
        } catch (dbError) {
            console.error('❌ Database update failed inside webhook:', dbError);
        }
    }
    res.send();
});

// ------------------------------------------------------------------
// --- 4. STANDARD MIDDLEWARE ---
// ------------------------------------------------------------------
app.use(express.json());

// ------------------------------------------------------------------
// --- 5. APP ROUTES ---
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
            email,
            password: hashedPassword,
            first_name,
            last_name,
            role: role || 'Member'
        });

        // Auto-create an empty Project for new users
        await Project.create({
            userId: newUser.id,
            name: 'New Project',
            status: 'Onboarding'
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
        next(error); 
    }
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
                role: user.role,
                planTier: user.planTier 
            } 
        });

    } catch (error) {
        next(error); 
    }
});

// Stripe Checkout Session
app.post('/api/create-checkout-session', protect, async (req, res, next) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [
                {
                    // Ensure this ID is correct in your Stripe Dashboard
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

// --- 👇 SECRET ADMIN PROMOTION ROUTE (Remove after use) ---
app.get('/make-admin/:email', async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.params.email } });
    if (!user) return res.status(404).send('User not found');
    
    // Force update the role
    user.role = 'admin'; 
    await user.save();
    
    res.send(`👑 Success! ${user.email} is now an Admin. Refresh your dashboard.`);
  } catch (err) {
    res.status(500).send(err.message);
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
            // ⚠️ UPDATED: Changed from 'force: true' to 'alter: true'.
            // 'force: true' deletes all data on every restart. 
            // 'alter: true' keeps data but updates table structure.
            await sequelize.sync({ alter: true });
            console.log('✅ Agency Database Ready! (All tables synced)');
        }

        app.listen(PORT, () => {
            console.log(`\nServer running securely on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('\n!!! Server failed to start:', e.message);
    }
};

startServer();