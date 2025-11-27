/// routes/logRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); 
const Log = require('../models/Log.js'); // Import the Log model

// --- 1. CREATE Log ---
// @route  POST /api/logs
// @desc   Create a new exercise log for the authenticated user
// @access Private
router.post('/', protect, async (req, res) => {
    // Destructure all required fields from the request body
    const { date, exercise, weight, reps, sets } = req.body;

    // Minimal validation: Ensure essential fields are present
    if (!exercise || !reps || !sets) {
        return res.status(400).json({ message: 'Please include the exercise name, reps, and sets.' });
    }

    try {
        const log = await Log.create({
            date: date || new Date().toISOString().split('T')[0], // Use provided date or today's date
            exercise,
            weight,
            reps,
            sets,
            userId: req.user.id, // Link to the logged-in user
        });

        res.status(201).json({ success: true, log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Exercise log creation failed' });
    }
});

// --- 2. READ Logs (Get All) ---
// @route  GET /api/logs
// @desc   Get all exercise logs for the authenticated user
// @access Private
router.get('/', protect, async (req, res) => {
    try {
        const logs = await Log.findAll({
            where: {
                userId: req.user.id // Fetch only the user's logs
            },
            order: [['date', 'DESC'], ['createdAt', 'DESC']] // Order by date, newest first
        });

        res.status(200).json({ success: true, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve exercise logs' });
    }
});

// --- 3. UPDATE Log ---
// @route  PUT /api/logs/:id
// @desc   Update a specific exercise log
// @access Private
router.put('/:id', protect, async (req, res) => {
    const { date, exercise, weight, reps, sets } = req.body;
    const logId = req.params.id;

    try {
        const log = await Log.findOne({
            // CRITICAL: Ensure the log exists AND belongs to the user
            where: { id: logId, userId: req.user.id }
        });

        if (!log) {
            return res.status(404).json({ message: 'Exercise log not found or unauthorized' });
        }

        // Apply updates only if the field is present in the request body
        if (date !== undefined) log.date = date;
        if (exercise !== undefined) log.exercise = exercise;
        if (weight !== undefined) log.weight = weight;
        if (reps !== undefined) log.reps = reps;
        if (sets !== undefined) log.sets = sets;

        await log.save();

        res.status(200).json({ success: true, message: 'Exercise log updated successfully', log });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Exercise log update failed' });
    }
});


// --- 4. DELETE Log ---
// @route  DELETE /api/logs/:id
// @desc   Delete a specific exercise log
// @access Private
router.delete('/:id', protect, async (req, res) => {
    const logId = req.params.id;

    try {
        // CRITICAL: Ensure the log belongs to the user before deleting
        const deletedRows = await Log.destroy({
            where: { id: logId, userId: req.user.id }
        });

        if (deletedRows === 0) {
            return res.status(404).json({ message: 'Exercise log not found or unauthorized' });
        }

        res.status(200).json({ success: true, message: 'Exercise log deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Exercise log deletion failed' });
    }
});

module.exports = router;