// middleware/auth.js (FINAL FIXED VERSION - Robust Token Extraction)

const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming you want to fetch the full user object later (optional but good practice)

// Middleware to verify the JWT from the request header
const protect = async (req, res, next) => {
    let token;
    // Handle potential casing issues with headers
    let authHeader = req.headers.authorization || req.headers.Authorization;

    // 1. Check for token and 'Bearer' prefix
    if (authHeader && authHeader.startsWith('Bearer')) {
        // Extract the token part (remove "Bearer ")
        token = authHeader.split(' ')[1];
        
        // CRITICAL CHECK: Ensure the token part exists after the split
        if (!token) {
             return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, token malformed (no value after Bearer)' 
            });
        }
    }

    if (!token) {
        // No token provided at all
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, no token' 
        });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Attach decoded user payload to the request object (req.user)
        // OPTIONAL: Fetch the full user object and exclude the password
        req.user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
        
        // Fallback if the user was deleted since the token was issued
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, user in token no longer exists' 
            });
        }
        
        next();
    } catch (error) {
        console.error('JWT verification failed:', error.name + ': ' + error.message);
        // Token is invalid or expired
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, token failed or expired' 
        });
    }
};

module.exports = { protect };