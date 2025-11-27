// routes/goalRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); 
const Goal = require('../models/Goal.js'); // Import the Goal model

// @route  POST /api/goals
// @desc   Create a new goal for the authenticated user
// @access Private
router.post('/', protect, async (req, res) => {
    const { description } = req.body;

    if (!description) {
        return res.status(400).json({ message: 'Please add a goal description' });
    }

    try {
        const goal = await Goal.create({
            description,
            userId: req.user.id, // Link to the logged-in user
            status: 'open'
        });

        res.status(201).json({ success: true, goal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Goal creation failed' });
    }
});

// @route  GET /api/goals
// @desc   Get all goals for the authenticated user
// @access Private
router.get('/', protect, async (req, res) => {
    try {
        const goals = await Goal.findAll({
            where: {
                userId: req.user.id // Fetch only the user's goals
            },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, goals });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve goals' });
    }
});

// @route  PUT /api/goals/:id
// @desc   Update a goal (description or status)
// @access Private
router.put('/:id', protect, async (req, res) => {
    const { description, status } = req.body;
    const goalId = req.params.id;

    try {
        const goal = await Goal.findOne({
            // CRITICAL: Ensure the goal exists AND belongs to the user
            where: { id: goalId, userId: req.user.id }
        });

        if (!goal) {
            return res.status(404).json({ message: 'Goal not found or unauthorized' });
        }

        if (description) goal.description = description;
        if (status) goal.status = status;

        await goal.save();

        res.status(200).json({ success: true, message: 'Goal updated successfully', goal });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Goal update failed' });
    }
});


// @route  DELETE /api/goals/:id
// @desc   Delete a goal
// @access Private
router.delete('/:id', protect, async (req, res) => {
    const goalId = req.params.id;

    try {
        // CRITICAL: Ensure the goal belongs to the user before deleting
        const deletedRows = await Goal.destroy({
            where: { id: goalId, userId: req.user.id }
        });

        if (deletedRows === 0) {
            return res.status(404).json({ message: 'Goal not found or unauthorized' });
        }

        res.status(200).json({ success: true, message: 'Goal deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Goal deletion failed' });
    }
});

module.exports = router;