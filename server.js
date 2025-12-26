require('dotenv').config();
const express = require('express');
const cors = require('cors');
const data = require('./data.json');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for custom exercises
let customExercises = [];
let nextCustomId = 1000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Get all exercises (built-in + custom)
 */
function getAllExercises() {
    return [...data.exercises, ...customExercises];
}

/**
 * GET /exercises
 * Query params:
 *   - muscle: filter by muscle group (optional)
 *   - difficulty: filter by difficulty (optional)
 *   - equipment: filter by equipment (optional)
 *   - page: page number for pagination (default: 1)
 *   - limit: items per page (default: 10, max: 50)
 * Returns paginated list of exercises
 */
app.get('/exercises', (req, res) => {
    const { muscle, difficulty, equipment, page = 1, limit = 10 } = req.query;

    let filteredExercises = data.exercises;

    // Apply filters
    if (muscle) {
        filteredExercises = filteredExercises.filter(
            ex => ex.muscle.toLowerCase() === muscle.toLowerCase()
        );
    }

    if (difficulty) {
        filteredExercises = filteredExercises.filter(
            ex => ex.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
    }

    if (equipment) {
        filteredExercises = filteredExercises.filter(
            ex => ex.equipment.toLowerCase().includes(equipment.toLowerCase())
        );
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

    res.json({
        exercises: paginatedExercises,
        pagination: {
            currentPage: pageNum,
            itemsPerPage: limitNum,
            totalItems: filteredExercises.length,
            totalPages: Math.ceil(filteredExercises.length / limitNum)
        }
    });
});

/**
 * GET /generate-workout
 * Query params:
 *   - muscle: chest | back | legs (optional)
 *   - difficulty: beginner | intermediate | advanced (optional)
 *   - count: number of exercises to return (default: 3, max: 10)
 * Returns random exercises matching the filters
 */
app.get('/generate-workout', (req, res) => {
    const { muscle, difficulty, count = 3 } = req.query;

    // Validate muscle parameter if provided
    const validMuscles = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    if (muscle && !validMuscles.includes(muscle.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid muscle parameter',
            validOptions: validMuscles
        });
    }

    // Validate difficulty parameter if provided
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (difficulty && !validDifficulties.includes(difficulty.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid difficulty parameter',
            validOptions: validDifficulties
        });
    }

    // Parse and validate count
    const exerciseCount = Math.min(10, Math.max(1, parseInt(count) || 3));

    // Filter exercises based on query parameters
    let filteredExercises = data.exercises;

    if (muscle) {
        filteredExercises = filteredExercises.filter(
            ex => ex.muscle.toLowerCase() === muscle.toLowerCase()
        );
    }

    if (difficulty) {
        filteredExercises = filteredExercises.filter(
            ex => ex.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
    }

    // Check if we have enough exercises
    if (filteredExercises.length === 0) {
        return res.status(404).json({
            error: 'No exercises found matching your criteria',
            muscle: muscle || 'any',
            difficulty: difficulty || 'any'
        });
    }

    // Shuffle and pick exercises
    const shuffled = shuffleArray(filteredExercises);
    const workout = shuffled.slice(0, Math.min(exerciseCount, shuffled.length));

    res.json({
        workout,
        count: workout.length,
        filters: {
            muscle: muscle || 'all',
            difficulty: difficulty || 'all'
        }
    });
});

/**
 * GET /workout-plan
 * Query params:
 *   - difficulty: beginner | intermediate | advanced (default: intermediate)
 *   - days: number of workout days per week (default: 5, max: 7)
 * Returns a weekly workout plan
 */
app.get('/workout-plan', (req, res) => {
    const { difficulty = 'intermediate', days = 5 } = req.query;

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid difficulty parameter',
            validOptions: validDifficulties
        });
    }

    // Parse and validate days
    const workoutDays = Math.min(7, Math.max(1, parseInt(days) || 5));

    // Define workout split based on difficulty
    const workoutSplits = {
        beginner: [
            { name: 'Full Body A', muscles: ['chest', 'back', 'legs'] },
            { name: 'Rest', muscles: [] },
            { name: 'Full Body B', muscles: ['shoulders', 'arms', 'core'] },
            { name: 'Rest', muscles: [] },
            { name: 'Full Body A', muscles: ['chest', 'back', 'legs'] },
            { name: 'Active Recovery', muscles: ['core'] },
            { name: 'Rest', muscles: [] }
        ],
        intermediate: [
            { name: 'Push Day', muscles: ['chest', 'shoulders'] },
            { name: 'Pull Day', muscles: ['back', 'arms'] },
            { name: 'Leg Day', muscles: ['legs', 'core'] },
            { name: 'Rest', muscles: [] },
            { name: 'Upper Body', muscles: ['chest', 'back', 'shoulders'] },
            { name: 'Lower Body', muscles: ['legs', 'core'] },
            { name: 'Rest', muscles: [] }
        ],
        advanced: [
            { name: 'Chest & Triceps', muscles: ['chest', 'arms'] },
            { name: 'Back & Biceps', muscles: ['back', 'arms'] },
            { name: 'Legs', muscles: ['legs'] },
            { name: 'Shoulders & Core', muscles: ['shoulders', 'core'] },
            { name: 'Upper Power', muscles: ['chest', 'back'] },
            { name: 'Lower Power', muscles: ['legs', 'core'] },
            { name: 'Active Recovery', muscles: ['core', 'shoulders'] }
        ]
    };

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const split = workoutSplits[difficulty.toLowerCase()];

    // Generate the weekly plan
    const weeklyPlan = [];

    for (let i = 0; i < 7; i++) {
        const dayPlan = split[i];

        if (dayPlan.muscles.length === 0) {
            // Rest day
            weeklyPlan.push({
                day: dayNames[i],
                type: dayPlan.name,
                exercises: []
            });
        } else {
            // Workout day - get exercises for each muscle group
            const dayExercises = [];

            for (const muscle of dayPlan.muscles) {
                const muscleExercises = data.exercises.filter(
                    ex => ex.muscle === muscle
                );
                const shuffled = shuffleArray(muscleExercises);
                // Pick 2 exercises per muscle group
                dayExercises.push(...shuffled.slice(0, 2));
            }

            weeklyPlan.push({
                day: dayNames[i],
                type: dayPlan.name,
                exercises: dayExercises
            });
        }
    }

    res.json({
        plan: weeklyPlan,
        difficulty: difficulty.toLowerCase(),
        totalWorkoutDays: weeklyPlan.filter(d => d.exercises.length > 0).length,
        totalExercises: weeklyPlan.reduce((sum, d) => sum + d.exercises.length, 0)
    });
});

/**
 * GET /warm-up
 * Query params:
 *   - type: upper | lower | cardio | core | full (default: full)
 *   - count: number of warm-up exercises (default: 5)
 * Returns warm-up routine
 */
app.get('/warm-up', (req, res) => {
    const { type = 'full', count = 5 } = req.query;

    const validTypes = ['upper', 'lower', 'cardio', 'core', 'full'];
    if (!validTypes.includes(type.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid type parameter',
            validOptions: validTypes
        });
    }

    let warmups = data.warmups || [];

    // Filter by type (or get all for 'full')
    if (type.toLowerCase() !== 'full') {
        warmups = warmups.filter(w => w.type === type.toLowerCase());
    }

    // Shuffle and pick
    const exerciseCount = Math.min(warmups.length, Math.max(1, parseInt(count) || 5));
    const shuffled = shuffleArray(warmups);
    const routine = shuffled.slice(0, exerciseCount);

    // Calculate totals
    const totalDuration = routine.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = routine.reduce((sum, w) => sum + w.calories, 0);

    res.json({
        warmup: routine,
        count: routine.length,
        totalDuration: `${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, '0')} min`,
        totalCalories,
        type: type.toLowerCase()
    });
});

/**
 * GET /random-exercise
 * Query params:
 *   - muscle: filter by muscle group (optional)
 *   - difficulty: filter by difficulty (optional)
 * Returns a single random exercise
 */
app.get('/random-exercise', (req, res) => {
    const { muscle, difficulty } = req.query;

    let exercises = getAllExercises();

    if (muscle) {
        exercises = exercises.filter(
            ex => ex.muscle.toLowerCase() === muscle.toLowerCase()
        );
    }

    if (difficulty) {
        exercises = exercises.filter(
            ex => ex.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
    }

    if (exercises.length === 0) {
        return res.status(404).json({
            error: 'No exercises found matching your criteria'
        });
    }

    const randomIndex = Math.floor(Math.random() * exercises.length);
    res.json({ exercise: exercises[randomIndex] });
});

/**
 * POST /exercises
 * Add a custom exercise
 * Body: { name, muscle, difficulty, description, equipment, sets, reps, duration, calories }
 */
app.post('/exercises', (req, res) => {
    const { name, muscle, difficulty, description, equipment } = req.body;

    // Validate required fields
    if (!name || !muscle || !difficulty) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['name', 'muscle', 'difficulty']
        });
    }

    // Validate muscle
    const validMuscles = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    if (!validMuscles.includes(muscle.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid muscle parameter',
            validOptions: validMuscles
        });
    }

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid difficulty parameter',
            validOptions: validDifficulties
        });
    }

    // Create new exercise
    const newExercise = {
        id: nextCustomId++,
        name,
        muscle: muscle.toLowerCase(),
        difficulty: difficulty.toLowerCase(),
        description: description || '',
        equipment: equipment || 'none',
        sets: req.body.sets || 3,
        reps: req.body.reps || '10-12',
        duration: req.body.duration || 30,
        calories: req.body.calories || 25,
        custom: true
    };

    customExercises.push(newExercise);

    res.status(201).json({
        message: 'Exercise created successfully',
        exercise: newExercise
    });
});

/**
 * DELETE /exercises/:id
 * Delete a custom exercise by ID
 */
app.delete('/exercises/:id', (req, res) => {
    const id = parseInt(req.params.id);

    // Check if it's a built-in exercise
    if (id < 1000) {
        return res.status(403).json({
            error: 'Cannot delete built-in exercises'
        });
    }

    const index = customExercises.findIndex(ex => ex.id === id);

    if (index === -1) {
        return res.status(404).json({
            error: 'Custom exercise not found'
        });
    }

    const deleted = customExercises.splice(index, 1)[0];
    res.json({
        message: 'Exercise deleted successfully',
        exercise: deleted
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Workout Generator API',
        version: '4.0.0',
        totalExercises: getAllExercises().length,
        customExercises: customExercises.length,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
        endpoints: {
            exercises: 'GET /exercises?muscle=chest&difficulty=beginner&page=1&limit=10',
            randomExercise: 'GET /random-exercise?muscle=chest',
            generateWorkout: 'GET /generate-workout?muscle=chest&difficulty=beginner&count=5',
            workoutPlan: 'GET /workout-plan?difficulty=intermediate',
            warmUp: 'GET /warm-up?type=upper&count=5',
            addExercise: 'POST /exercises { name, muscle, difficulty, ... }',
            deleteExercise: 'DELETE /exercises/:id',
            health: 'GET /health'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏋️ Workout Generator API running on http://localhost:${PORT}`);
});
