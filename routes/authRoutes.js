const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node module for generating random tokens
const nodemailer = require('nodemailer'); // ⚠️ You need to install this: npm install nodemailer
const User = require('../models/User');
const Project = require('../models/Project');

// --- 📧 EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // false for 587, true for 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
});

// --- 1. REGISTER USER ---
// @route  POST /api/auth/register
// @desc   Register user & send verification email
router.post(
    '/register',
    [
        body('first_name', 'First name is required').not().isEmpty(),
        body('last_name', 'Last name is required').not().isEmpty(),
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password must be 6 or more characters').isLength({ min: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { email, password, first_name, last_name } = req.body;

            // Check if user exists
            let user = await User.findOne({ where: { email } });
            if (user) return res.status(400).json({ message: 'User already exists' });

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Generate Verification Token
            const verificationToken = crypto.randomBytes(20).toString('hex');

            // Create User (isVerified = false by default)
            user = await User.create({
                first_name,
                last_name,
                email,
                password: hashedPassword,
                verificationToken
            });

            // Create Default Project for Dashboard
            await Project.create({
                userId: user.id,
                name: 'Alpha Project',
                status: 'Discovery',
                progress: 10,
                clientName: `${first_name} ${last_name}`
            });

            // Send Verification Email
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Dewhitt App" <noreply@dewhittdesigns.com>',
                to: user.email,
                subject: 'Verify your email for Dewhitt App',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #333;">Hello ${user.first_name},</h2>
                        <p style="font-size: 16px; color: #555;">Thank you for signing up! Please verify your email address to activate your account.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
                        </div>
                        <p style="font-size: 14px; color: #888;">If the button above doesn't work, copy and paste this link into your browser:</p>
                        <p style="font-size: 12px; color: #007bff; word-break: break-all;">${verifyUrl}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #aaa;">This is an automated message, please do not reply.</p>
                    </div>
                `
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log("✅ Verification email sent to:", user.email);
            } catch (emailErr) {
                console.error("⚠️ Email failed (User still registered):", emailErr.message);
            }

            res.status(201).json({
                success: true,
                message: 'Registration successful! (Check server logs if email did not arrive)'
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error during registration' });
        }
    }
);

// --- 2. VERIFY EMAIL ---
// @route  GET /verify-email (Catch-all for browser clicks hitting Backend)
router.get('/verify-email', (req, res) => {
    // If the user hits this, CLIENT_URL is likely wrong in Render.
    // We can try to redirect them to the frontend if we know the URL,
    // or just show a helpful message.
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Redirecting...</h1>
            <p>You reached the API server. We are sending you to the App.</p>
            <script>
                // Try to guess the frontend URL or use a hardcoded fallback
                // Ideally, this should never happen if CLIENT_URL is correct.
                window.location.href = "https://dewhittdesigns.com/verify-email?token=${req.query.token}";
            </script>
        </div>
    `);
});

// @route  POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        console.log("🔍 Received verification request with token:", token);

        const user = await User.findOne({ where: { verificationToken: token } });

        if (!user) {
            console.log("❌ No user found with that verification token.");
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        console.log("✅ User found:", user.email, "Current isVerified status:", user.isVerified);

        // Verify User
        user.isVerified = true;
        user.verificationToken = null; // Clear token so it can't be reused
        await user.save();

        console.log("🎉 Email verified successfully for:", user.email);
        res.json({ success: true, message: 'Email verified successfully! You can now log in.' });

    } catch (err) {
        console.error("🔥 Server error during verification:", err);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

// --- 3. LOGIN USER ---
// @route  POST /api/auth/login
// @desc   Authenticate user & get token
router.post(
    '/login',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password is required').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { email, password } = req.body;

            // Check for user
            const user = await User.findOne({ where: { email } });
            if (!user) return res.status(400).json({ message: 'Invalid credentials' });

            // Check Verification Status
            if (!user.isVerified) {
                return res.status(401).json({ message: 'Please verify your email before logging in.' });
            }

            // Validate Password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

            // Return JWT
            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    name: `${user.first_name} ${user.last_name}`,
                    email: user.email,
                    role: user.role,
                    planTier: user.planTier
                }
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

module.exports = router;