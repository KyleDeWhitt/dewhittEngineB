const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const FoodLog = require('../models/FoodLog');

// --- Helpers ---
const ACTIVITY_FACTORS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very: 1.9
};

const GOAL_DELTAS = { lose: -500, build: 300, maintain: 0, endurance: 200 };

const toKg = (weight, unit) => unit === 'metric' ? Number(weight) : Number(weight) * 0.453592;
const toCm = (height, unit) => unit === 'metric' ? Number(height) : Number(height) * 2.54;

const pad = (n) => String(n).padStart(2, '0');

// Format a Date as a LOCAL "YYYY-MM-DD" (matches the calendar the user sees)
const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function todayStr() {
    return toLocalISO(new Date());
}

function lastNDates(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        out.push(toLocalISO(d));
    }
    return out;
}

// Mifflin-St Jeor estimate
function computeCalorieTarget(user) {
    if (!user.height || !user.currentWeight || !user.gender || !user.age) return null;
    const kg = toKg(user.currentWeight, user.unit);
    const cm = toCm(user.height, user.unit);
    const base = (10 * kg) + (6.25 * cm) - (5 * Number(user.age)) + (user.gender === 'male' ? 5 : -161);
    const factor = ACTIVITY_FACTORS[user.activityLevel] || 1.55;
    const delta = GOAL_DELTAS[user.goalType] || 0;
    return Math.round(base * factor + delta);
}

const bucketForType = (type) => {
    if (type === 'Cardio') return 'cardio';
    if (type === 'Mobility' || type === 'Yoga') return 'mobility';
    if (type === 'Strength') return 'strength';
    return 'other';
};

// --- GET /api/fitness/overview ---
router.get('/overview', protect, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'first_name', 'last_name', 'email', 'planTier', 'height', 'currentWeight', 'goalWeight', 'startWeight', 'unit', 'gender', 'age', 'activityLevel', 'goalType']
        });
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const dates = lastNDates(7);
        const today = dates[dates.length - 1];

        const [logs, workouts] = await Promise.all([
            DailyLog.findAll({ where: { userId: user.id, date: { [Op.in]: dates } } }),
            WorkoutLog.findAll({ where: { userId: user.id }, order: [['date', 'DESC'], ['id', 'DESC']] })
        ]);

        const logByDate = {};
        logs.forEach(l => { logByDate[l.date] = l; });

        const minutesByDate = {};
        const caloriesByDate = {};
        workouts.forEach(w => {
            if (!minutesByDate[w.date]) minutesByDate[w.date] = { strength: 0, cardio: 0, mobility: 0, other: 0 };
            minutesByDate[w.date][bucketForType(w.type)] += (Number(w.durationMinutes) || 0);
            caloriesByDate[w.date] = (caloriesByDate[w.date] || 0) + (Number(w.caloriesBurned) || 0);
        });

        const week = dates.map(date => {
            const log = logByDate[date];
            const m = minutesByDate[date] || { strength: 0, cardio: 0, mobility: 0, other: 0 };
            return {
                date,
                label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
                isToday: date === today,
                steps: log?.steps || 0,
                activeMinutes: log?.activeMinutes || 0,
                caloriesBurned: caloriesByDate[date] || 0,
                strength: m.strength,
                cardio: m.cardio,
                mobility: m.mobility,
                other: m.other
            };
        });

        const todayLog = logByDate[today] || null;

        const weightTrend = logs
            .filter(l => l.weight != null)
            .map(l => ({ date: l.date, weight: Number(l.weight) }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const unitLabel = user.unit === 'metric' ? 'kg' : 'lb';

        const current = Number(user.currentWeight) || null;
        const goal = Number(user.goalWeight) || null;
        const start = Number(user.startWeight) || null;

        let percentToGoal = null;
        if (start && goal && current && start !== goal) {
            percentToGoal = Math.min(100, Math.max(0, Math.round(((start - current) / (start - goal)) * 100)));
        }

        const losing = user.goalType === 'lose' || user.goalType === 'maintain' || user.goalType === 'endurance';

        res.json({
            success: true,
            profile: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                planTier: user.planTier,
                height: user.height,
                currentWeight: current,
                goalWeight: goal,
                startWeight: start,
                unit: user.unit,
                unitLabel,
                gender: user.gender,
                age: user.age,
                activityLevel: user.activityLevel,
                goalType: user.goalType,
                calorieTarget: computeCalorieTarget(user),
                isComplete: !!(user.height && user.currentWeight && user.goalWeight && user.gender && user.age)
            },
            weight: {
                current,
                goal,
                start,
                unitLabel,
                totalToMove: (start && goal) ? Number(Math.abs(start - goal).toFixed(1)) : null,
                movedSoFar: (start && current) ? Number(Math.abs(start - current).toFixed(1)) : 0,
                percentToGoal,
                losing
            },
            today: todayLog ? {
                steps: todayLog.steps,
                waterGlasses: todayLog.waterGlasses,
                activeMinutes: todayLog.activeMinutes,
                sleepHours: todayLog.sleepHours,
                heartRateAvg: todayLog.heartRateAvg,
                caloriesConsumed: todayLog.caloriesConsumed,
                protein: todayLog.protein,
                carbs: todayLog.carbs,
                fat: todayLog.fat,
                weight: todayLog.weight,
                caloriesBurned: caloriesByDate[today] || 0
            } : null,
            week,
            workouts: workouts.slice(0, 10).map(w => ({
                id: w.id,
                type: w.type,
                durationMinutes: w.durationMinutes,
                caloriesBurned: w.caloriesBurned,
                date: w.date,
                notes: w.notes
            })),
            weightTrend
        });
    } catch (err) {
        console.error('Fitness overview error:', err);
        res.status(500).json({ message: 'Failed to load fitness overview.' });
    }
});
// --- POST /api/fitness/workouts ---
router.post('/workouts', protect, async (req, res) => {
    try {
        const { type, durationMinutes, caloriesBurned, sets, reps, load, date, notes } = req.body;
        if (!type) {
            return res.status(400).json({ message: 'Exercise name is required.' });
        }
        const workout = await WorkoutLog.create({
            userId: req.user.id,
            type,
            durationMinutes: Number(durationMinutes) || 0,
            caloriesBurned: Number(caloriesBurned) || 0,
            sets: sets ? Number(sets) : null,
            reps: reps ? Number(reps) : null,
            load: load ? Number(load) : null,
            date: date || todayStr(),
            notes: notes || null
        });
        res.status(201).json({ success: true, workout });
    } catch (err) {
        console.error('Log workout error:', err);
        res.status(500).json({ message: 'Failed to log workout.' });
    }
});

// --- PUT /api/fitness/log (upsert a day's metrics) ---
router.put('/log', protect, async (req, res) => {
    try {
        const date = req.body.date || todayStr();
        const numericFields = ['steps', 'waterGlasses', 'activeMinutes', 'sleepHours', 'heartRateAvg', 'caloriesConsumed', 'protein', 'carbs', 'fat', 'weight'];
        const stringFields = ['food', 'notes'];
        const payload = { userId: req.user.id, date };
        numericFields.forEach(k => {
            if (req.body[k] !== undefined && req.body[k] !== null) payload[k] = Number(req.body[k]);
        });
        stringFields.forEach(k => {
            if (req.body[k] !== undefined) payload[k] = req.body[k];
        });

        let log = await DailyLog.findOne({ where: { userId: req.user.id, date } });
        if (log) {
            await log.update(payload);
        } else {
            log = await DailyLog.create(payload);
        }

        // Keep the user's "current weight" in sync when a weigh-in is logged
        if (payload.weight !== undefined) {
            await User.update({ currentWeight: payload.weight }, { where: { id: req.user.id } });
        }

        res.json({ success: true, log });
    } catch (err) {
        console.error('Log daily error:', err);
        res.status(500).json({ message: 'Failed to save daily log.' });
    }
});

// --- GET /api/fitness/calendar?year=YYYY&month=M ---
router.get('/calendar', protect, async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.query.year) || now.getFullYear();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const start = `${year}-${pad(month)}-01`;
        const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

        const dates = [];
        for (let d = 1; d <= daysInMonth; d++) dates.push(`${year}-${pad(month)}-${pad(d)}`);

        const [logs, workouts] = await Promise.all([
            DailyLog.findAll({ where: { userId: req.user.id, date: { [Op.between]: [start, end] } } }),
            WorkoutLog.findAll({ where: { userId: req.user.id, date: { [Op.between]: [start, end] } } })
        ]);

        const logByDate = {};
        logs.forEach(l => { logByDate[l.date] = l; });
        const wkByDate = {};
        workouts.forEach(w => { (wkByDate[w.date] = wkByDate[w.date] || []).push(w); });

        const days = dates.map(date => {
            const log = logByDate[date];
            const wk = wkByDate[date] || [];
            const caloriesBurned = wk.reduce((s, w) => s + (Number(w.caloriesBurned) || 0), 0);
            const workoutMinutes = wk.reduce((s, w) => s + (Number(w.durationMinutes) || 0), 0);
            return {
                date,
                day: Number(date.slice(8, 10)),
                hasData: !!log || wk.length > 0,
                steps: log?.steps || 0,
                waterGlasses: log?.waterGlasses || 0,
                sleepHours: log?.sleepHours || 0,
                caloriesConsumed: log?.caloriesConsumed || 0,
                caloriesBurned,
                workoutMinutes,
                workoutCount: wk.length,
                food: log?.food || '',
                notes: log?.notes || '',
                workouts: wk.map(w => ({ id: w.id, type: w.type, durationMinutes: w.durationMinutes, caloriesBurned: w.caloriesBurned, sets: w.sets, reps: w.reps, load: w.load, notes: w.notes }))
            };
        });

        res.json({ success: true, year, month, days });
    } catch (err) {
        console.error('Calendar error:', err);
        res.status(500).json({ message: 'Failed to load calendar.' });
    }
});

// --- PUT /api/fitness/workouts/:id (edit a workout) ---
router.put('/workouts/:id', protect, async (req, res) => {
    try {
        const workout = await WorkoutLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!workout) return res.status(404).json({ message: 'Workout not found.' });

        const { type, durationMinutes, caloriesBurned, sets, reps, load, date, notes } = req.body;
        if (type !== undefined) workout.type = type;
        if (durationMinutes !== undefined) workout.durationMinutes = Number(durationMinutes) || 0;
        if (caloriesBurned !== undefined) workout.caloriesBurned = Number(caloriesBurned) || 0;
        workout.sets = (sets !== undefined && sets !== null && sets !== '') ? Number(sets) : null;
        workout.reps = (reps !== undefined && reps !== null && reps !== '') ? Number(reps) : null;
        workout.load = (load !== undefined && load !== null && load !== '') ? Number(load) : null;
        if (date !== undefined) workout.date = date;
        if (notes !== undefined) workout.notes = notes || null;

        await workout.save();
        res.json({ success: true, workout });
    } catch (err) {
        console.error('Update workout error:', err);
        res.status(500).json({ message: 'Failed to update workout.' });
    }
});

// --- DELETE /api/fitness/workouts/:id ---
router.delete('/workouts/:id', protect, async (req, res) => {
    try {
        const workout = await WorkoutLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!workout) return res.status(404).json({ message: 'Workout not found.' });
        await workout.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('Delete workout error:', err);
        res.status(500).json({ message: 'Failed to delete workout.' });
    }
});

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Recompute a day's calorie/macro totals from its food items and cache on DailyLog
async function recalcDayFood(userId, date) {
    const items = await FoodLog.findAll({ where: { userId, date } });
    const sum = (f) => items.reduce((s, it) => s + (Number(it[f]) || 0), 0);
    const totals = {
        caloriesConsumed: Math.round(sum('calories')),
        protein: round1(sum('protein')),
        carbs: round1(sum('carbs')),
        fat: round1(sum('fat')),
    };
    let daily = await DailyLog.findOne({ where: { userId, date } });
    if (daily) await daily.update(totals);
    else await DailyLog.create({ userId, date, ...totals });
    return totals;
}

// --- GET /api/fitness/foods?date=YYYY-MM-DD ---
router.get('/foods', protect, async (req, res) => {
    try {
        const date = req.query.date || todayStr();
        const items = await FoodLog.findAll({ where: { userId: req.user.id, date }, order: [['id', 'ASC']] });
        const totals = {
            calories: Math.round(items.reduce((s, it) => s + (Number(it.calories) || 0), 0)),
            protein: round1(items.reduce((s, it) => s + (Number(it.protein) || 0), 0)),
            carbs: round1(items.reduce((s, it) => s + (Number(it.carbs) || 0), 0)),
            fat: round1(items.reduce((s, it) => s + (Number(it.fat) || 0), 0)),
        };
        res.json({ success: true, foods: items, totals });
    } catch (err) {
        console.error('List foods error:', err);
        res.status(500).json({ message: 'Failed to load foods.' });
    }
});

// --- POST /api/fitness/foods ---
router.post('/foods', protect, async (req, res) => {
    try {
        const { name, serving, calories, protein, carbs, fat, date } = req.body;
        if (!name) return res.status(400).json({ message: 'Food name is required.' });
        const item = await FoodLog.create({
            userId: req.user.id,
            date: date || todayStr(),
            name,
            serving: serving || null,
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
        });
        const totals = await recalcDayFood(req.user.id, item.date);
        res.status(201).json({ success: true, item, totals });
    } catch (err) {
        console.error('Add food error:', err);
        res.status(500).json({ message: 'Failed to add food.' });
    }
});

// --- DELETE /api/fitness/foods/:id ---
router.delete('/foods/:id', protect, async (req, res) => {
    try {
        const item = await FoodLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!item) return res.status(404).json({ message: 'Food not found.' });
        await item.destroy();
        const totals = await recalcDayFood(req.user.id, item.date);
        res.json({ success: true, totals });
    } catch (err) {
        console.error('Delete food error:', err);
        res.status(500).json({ message: 'Failed to delete food.' });
    }
});

// --- GET /api/fitness/food-search?q= (Open Food Facts, no API key required) ---
router.get('/food-search', protect, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, results: [] });

    let data = null;
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
        try {
            const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) +
                '&search_simple=1&action=process&json=1&page_size=12';
            const r = await fetch(url, { headers: { 'User-Agent': 'DeWhittFit/1.0 (local dev)' } });
            if (r.ok) data = await r.json();
        } catch (e) { /* retry */ }
        if (!data) await new Promise(res => setTimeout(res, 400));
    }
    if (!data) {
        return res.json({ success: true, results: [], error: 'Food database unavailable \u2014 enter macros manually.' });
    }

    const results = (data.products || [])
        .filter(p => p.product_name && p.nutriments)
        .map(p => ({
            name: p.product_name + (p.brands ? ' (' + p.brands.split(',')[0] + ')' : ''),
            serving: '100 g',
            calories: Math.round(Number(p.nutriments['energy-kcal_100g'] || p.nutriments['energy_100g'] || 0)),
            protein: round1(p.nutriments.proteins_100g),
            carbs: round1(p.nutriments.carbohydrates_100g),
            fat: round1(p.nutriments.fat_100g),
        }))
        .filter(x => x.calories > 0 || x.protein > 0);
    res.json({ success: true, results });
});

// --- GET /api/fitness/prs (all-time personal records from loaded lifts) ---
router.get('/prs', protect, async (req, res) => {
    try {
        const workouts = await WorkoutLog.findAll({
            where: { userId: req.user.id, load: { [Op.ne]: null } },
            order: [['date', 'ASC']]
        });
        const best = {};
        workouts.forEach(w => {
            if (!w.load || !w.reps) return;
            const e1rm = Number(w.load) * (1 + Number(w.reps) / 30); // Epley estimate
            if (!best[w.type] || e1rm > best[w.type].e1rm) {
                best[w.type] = { exercise: w.type, load: Number(w.load), reps: Number(w.reps), sets: w.sets, e1rm: round1(e1rm), date: w.date };
            }
        });
        const prs = Object.values(best).sort((a, b) => b.e1rm - a.e1rm);
        res.json({ success: true, prs });
    } catch (err) {
        console.error('PRs error:', err);
        res.status(500).json({ message: 'Failed to load records.' });
    }
});

// --- GET /api/fitness/streak (current + best consecutive logging day streak) ---
router.get('/streak', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const [dl, wl, fl] = await Promise.all([
            DailyLog.findAll({ where: { userId }, attributes: ['date'] }),
            WorkoutLog.findAll({ where: { userId }, attributes: ['date'] }),
            FoodLog.findAll({ where: { userId }, attributes: ['date'] }),
        ]);
        const active = new Set();
        [...dl, ...wl, ...fl].forEach(r => { if (r.date) active.add(r.date); });

        const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return toLocalISO(d); };

        // current streak (kept alive through today until the day ends)
        const today = todayStr();
        let cursor = active.has(today) ? today : addDays(today, -1);
        let current = 0;
        while (active.has(cursor)) { current++; cursor = addDays(cursor, -1); }

        // best (longest) streak ever
        const dates = [...active].sort();
        let best = 0, run = 0;
        dates.forEach((date, i) => {
            run = (i > 0 && date === addDays(dates[i - 1], 1)) ? run + 1 : 1;
            if (run > best) best = run;
        });

        res.json({ success: true, current, best, activeDays: dates.length });
    } catch (err) {
        console.error('Streak error:', err);
        res.status(500).json({ message: 'Failed to load streak.' });
    }
});

module.exports = router;