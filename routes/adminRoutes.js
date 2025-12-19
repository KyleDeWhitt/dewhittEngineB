const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');

// Middleware: Only allow users with role="admin"
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as admin' });
    }
};

// GET /api/admin/clients - List all clients and their projects
router.get('/clients', protect, adminOnly, async (req, res) => {
    try {
        const clients = await User.findAll({
            where: { role: 'Member' },
            include: [Project], // Join with Project table
            attributes: { exclude: ['password'] }
        });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// PUT /api/admin/project/:userId - Update a client's project
router.put('/project/:userId', protect, adminOnly, async (req, res) => {
    try {
        const { name, status, progress, nextInvoiceDate, subscriptionAmount } = req.body;
        
        // Find project or create one if it doesn't exist
        const [project, created] = await Project.findOrCreate({
            where: { userId: req.params.userId },
            defaults: { name, status, progress, nextInvoiceDate, subscriptionAmount }
        });

        if (!created) {
            // Only update fields that were actually sent in the request
            if (name !== undefined) project.name = name;
            if (status !== undefined) project.status = status;
            if (progress !== undefined) project.progress = progress;
            if (nextInvoiceDate !== undefined) project.nextInvoiceDate = nextInvoiceDate;
            if (subscriptionAmount !== undefined) project.subscriptionAmount = subscriptionAmount;
            
            await project.save();
        }

        res.json({ success: true, project });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Update failed' });
    }
});

module.exports = router;