// routes/userRoutes.js (UPDATED TO INCLUDE PROFILE SETUP)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { protect } = require('../middleware/auth'); 
const User = require('../models/User'); 

// --- 1. GET User Profile ---
// @route  GET /api/user/profile
// @desc   Get the current authenticated user's profile data
// @access Private
router.get('/profile', protect, async (req, res) => {
    try {
        // Fetch user data by the ID attached during JWT verification (req.user.id)
        const user = await User.findByPk(req.user.id, {
            // Fetching core user fields
            attributes: ['id', 'email', 'first_name', 'last_name', 'role', 'createdAt', 'updatedAt']
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve user data.' });
    }
});

// --- 2. UPDATE User Profile ---
// @route  PUT /api/user/profile
// @desc   Update the current authenticated user's profile data (name or password)
// @access Private
router.put('/profile', protect, async (req, res) => {
    // Get fields from the request body
    const { first_name, last_name, password } = req.body;

    try {
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update Name Fields
        if (first_name) {
            user.first_name = first_name;
        }
        if (last_name) {
            user.last_name = last_name;
        }

        // Update Password (requires hashing!)
        if (password) {
            if (password.length < 6) { // Simple validation
                 return res.status(400).json({ message: 'Password must be at least 6 characters.' });
            }
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();

        // Respond with updated (but non-sensitive) user data
        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: { 
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update user profile.' });
    }
});

// ----------------------------------------------------------------------------------
// --- 3. PUT Profile Setup (NEW ROUTE) ---
// ----------------------------------------------------------------------------------
// @route  PUT /api/user/setup-profile/:id
// @desc   Initial setup of user metrics (height, weight, goal)
// @access Private
router.put('/setup-profile/:id', protect, async (req, res) => {
    const userId = req.user.id; // Get ID from JWT token (secure)
    const { height, currentWeight, goalWeight, unit } = req.body;

    // Security Check: Ensure user only updates their own profile
    if (parseInt(req.params.id) !== userId) {
        return res.status(403).json({ message: 'Unauthorized profile update.' });
    }

    try {
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update all the initial profile metrics
        user.height = height;
        user.currentWeight = currentWeight;
        user.goalWeight = goalWeight;
        user.unit = unit;

        await user.save();

        res.status(200).json({ 
            success: true, 
            message: 'Profile metrics saved successfully.'
        });

    } catch (error) {
        console.error('Profile setup error:', error);
        res.status(500).json({ message: 'Failed to save profile metrics.' });
    }
});


module.exports = router;