const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node module for generating random tokens
const nodemailer = require('nodemailer'); // ⚠️ You need to install this: npm install nodemailer
const User = require('../models/User');

// --- 📧 EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
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
            const verificationToken = crypto.randomBytes(20).toString({ encoding: 'hex' });

            // Create User (isVerified = false by default)
            user = await User.create({
                first_name,
                last_name,
                email,
                password: hashedPassword,
                verificationToken
            });

            // Send Verification Email
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Verify your email for Dewhitt App',
                html: `
                    <h3>Hello ${user.first_name},</h3>
                    <p>Please verify your email by clicking the link below:</p>
                    <a href="${verifyUrl}">Verify Email</a>
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

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error during registration' });
        }
    }
);

// --- 2. VERIFY EMAIL ---
// @route  GET /api/auth/verify-email
// @desc   Verify user email via token
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