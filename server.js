require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const data = require('./data.json');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
let customExercises = [];
let nextCustomId = 1000;
let favorites = new Set();
let workoutHistory = [];
let requestLogs = [];
let apiStats = {
    totalRequests: 0,
    endpointHits: {},
    popularExercises: {},
    startTime: new Date().toISOString(),
    rateLimitHits: 0
};

// Exercise categories
const exerciseCategories = {
    compound: [1, 4, 7, 8, 9, 12, 14, 15, 18, 20, 21, 25, 36, 40, 45, 48],
    isolation: [2, 3, 5, 6, 10, 11, 13, 16, 17, 19, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 41, 42, 43, 44, 46, 47, 49, 50],
    push: [1, 2, 3, 4, 5, 6, 7, 21, 23, 24, 25, 27, 29, 36, 37, 38],
    pull: [8, 9, 10, 11, 12, 13, 14, 26, 28, 30, 40, 41, 42]
};

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML landing page)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT || 100, // Limit each IP
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        apiStats.rateLimitHits++;
        res.status(options.statusCode).json(options.message);
    }
});
app.use('/api', limiter);
app.use('/exercises', limiter);
app.use('/exercise', limiter);
app.use('/generate-workout', limiter);
app.use('/workout-plan', limiter);
app.use('/superset', limiter);
app.use('/hiit', limiter);

// API Key validation middleware (optional - for RapidAPI)
const validateApiKey = (req, res, next) => {
    // RapidAPI sends key in X-RapidAPI-Key header
    // For direct access, check X-API-Key header
    const rapidApiKey = req.headers['x-rapidapi-key'];
    const directApiKey = req.headers['x-api-key'];
    const expectedKey = process.env.API_KEY;

    // Skip validation if no API_KEY is set in env (development mode)
    if (!expectedKey) {
        return next();
    }

    // RapidAPI handles its own auth, so allow those requests
    if (rapidApiKey) {
        return next();
    }

    // For direct access, validate API key
    if (directApiKey !== expectedKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing API key. Include X-API-Key header.'
        });
    }

    next();
};

// Request logging middleware
app.use((req, res, next) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']?.substring(0, 50)
    };

    // Keep last 1000 logs
    requestLogs.push(logEntry);
    if (requestLogs.length > 1000) {
        requestLogs.shift();
    }

    // Update stats
    apiStats.totalRequests++;
    const endpoint = req.path;
    apiStats.endpointHits[endpoint] = (apiStats.endpointHits[endpoint] || 0) + 1;

    next();
});

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
 * Get exercise category
 */
function getExerciseCategory(id) {
    return {
        compound: exerciseCategories.compound.includes(id),
        isolation: exerciseCategories.isolation.includes(id),
        push: exerciseCategories.push.includes(id),
        pull: exerciseCategories.pull.includes(id)
    };
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

/**
 * GET /stats
 * Returns API usage statistics
 */
app.get('/stats', (req, res) => {
    const uptime = Math.floor((Date.now() - new Date(apiStats.startTime).getTime()) / 1000);

    // Get top 5 endpoints
    const topEndpoints = Object.entries(apiStats.endpointHits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([endpoint, hits]) => ({ endpoint, hits }));

    // Get top 5 popular exercises
    const topExercises = Object.entries(apiStats.popularExercises)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, views]) => {
            const exercise = getAllExercises().find(ex => ex.id === parseInt(id));
            return { name: exercise?.name || 'Unknown', views };
        });

    res.json({
        totalRequests: apiStats.totalRequests,
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
        startTime: apiStats.startTime,
        topEndpoints,
        topExercises,
        totalExercises: getAllExercises().length,
        customExercises: customExercises.length,
        totalFavorites: favorites.size
    });
});

/**
 * GET /exercise/:id
 * Get single exercise by ID with categories
 */
app.get('/exercise/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const exercise = getAllExercises().find(ex => ex.id === id);

    if (!exercise) {
        return res.status(404).json({ error: 'Exercise not found' });
    }

    // Track popularity
    apiStats.popularExercises[id] = (apiStats.popularExercises[id] || 0) + 1;

    res.json({
        ...exercise,
        categories: getExerciseCategory(id),
        isFavorite: favorites.has(id)
    });
});

/**
 * GET /muscles
 * List all muscle groups with exercise counts
 */
app.get('/muscles', (req, res) => {
    const muscles = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    const allExercises = getAllExercises();

    const muscleData = muscles.map(muscle => {
        const exercises = allExercises.filter(ex => ex.muscle === muscle);
        return {
            muscle,
            exerciseCount: exercises.length,
            difficulties: {
                beginner: exercises.filter(ex => ex.difficulty === 'beginner').length,
                intermediate: exercises.filter(ex => ex.difficulty === 'intermediate').length,
                advanced: exercises.filter(ex => ex.difficulty === 'advanced').length
            }
        };
    });

    res.json({
        muscles: muscleData,
        totalExercises: allExercises.length
    });
});

/**
 * GET /superset
 * Generate superset pairs (antagonist muscle groups)
 * Query params:
 *   - type: push-pull | upper-lower | same-muscle (default: push-pull)
 *   - sets: number of superset pairs (default: 3)
 */
app.get('/superset', (req, res) => {
    const { type = 'push-pull', sets = 3 } = req.query;

    const allExercises = getAllExercises();
    const setCount = Math.min(5, Math.max(1, parseInt(sets) || 3));

    let supersets = [];

    if (type === 'push-pull') {
        const pushExercises = allExercises.filter(ex => exerciseCategories.push.includes(ex.id));
        const pullExercises = allExercises.filter(ex => exerciseCategories.pull.includes(ex.id));

        const shuffledPush = shuffleArray(pushExercises);
        const shuffledPull = shuffleArray(pullExercises);

        for (let i = 0; i < setCount && i < shuffledPush.length && i < shuffledPull.length; i++) {
            supersets.push({
                setNumber: i + 1,
                exercise1: { ...shuffledPush[i], type: 'push' },
                exercise2: { ...shuffledPull[i], type: 'pull' }
            });
        }
    } else if (type === 'upper-lower') {
        const upperMuscles = ['chest', 'back', 'shoulders', 'arms'];
        const lowerMuscles = ['legs', 'core'];

        const upperExercises = shuffleArray(allExercises.filter(ex => upperMuscles.includes(ex.muscle)));
        const lowerExercises = shuffleArray(allExercises.filter(ex => lowerMuscles.includes(ex.muscle)));

        for (let i = 0; i < setCount && i < upperExercises.length && i < lowerExercises.length; i++) {
            supersets.push({
                setNumber: i + 1,
                exercise1: { ...upperExercises[i], type: 'upper' },
                exercise2: { ...lowerExercises[i], type: 'lower' }
            });
        }
    } else if (type === 'same-muscle') {
        const muscles = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
        const randomMuscle = muscles[Math.floor(Math.random() * muscles.length)];
        const muscleExercises = shuffleArray(allExercises.filter(ex => ex.muscle === randomMuscle));

        for (let i = 0; i < setCount * 2 && i + 1 < muscleExercises.length; i += 2) {
            supersets.push({
                setNumber: Math.floor(i / 2) + 1,
                exercise1: muscleExercises[i],
                exercise2: muscleExercises[i + 1],
                muscle: randomMuscle
            });
        }
    }

    res.json({
        type,
        supersets,
        totalSets: supersets.length,
        restBetweenSupersets: '60-90 seconds'
    });
});

/**
 * GET /hiit
 * Generate HIIT workout with intervals
 * Query params:
 *   - rounds: number of rounds (default: 4)
 *   - work: work interval in seconds (default: 40)
 *   - rest: rest interval in seconds (default: 20)
 */
app.get('/hiit', (req, res) => {
    const { rounds = 4, work = 40, rest = 20 } = req.query;

    const roundCount = Math.min(10, Math.max(1, parseInt(rounds) || 4));
    const workTime = Math.min(120, Math.max(10, parseInt(work) || 40));
    const restTime = Math.min(120, Math.max(5, parseInt(rest) || 20));

    // HIIT-friendly exercises (bodyweight, explosive)
    const hiitExercises = [
        { name: 'Burpees', calories: 15 },
        { name: 'Mountain Climbers', calories: 12 },
        { name: 'Jump Squats', calories: 14 },
        { name: 'High Knees', calories: 11 },
        { name: 'Box Jumps', calories: 15 },
        { name: 'Plank Jacks', calories: 10 },
        { name: 'Jumping Lunges', calories: 14 },
        { name: 'Tuck Jumps', calories: 16 },
        { name: 'Speed Skaters', calories: 12 },
        { name: 'Bicycle Crunches', calories: 8 }
    ];

    const shuffled = shuffleArray(hiitExercises);
    const selectedExercises = shuffled.slice(0, roundCount);

    const workout = selectedExercises.map((ex, i) => ({
        round: i + 1,
        exercise: ex.name,
        workSeconds: workTime,
        restSeconds: restTime,
        estimatedCalories: Math.round(ex.calories * (workTime / 40))
    }));

    const totalTime = roundCount * (workTime + restTime);
    const totalCalories = workout.reduce((sum, r) => sum + r.estimatedCalories, 0);

    res.json({
        workout,
        summary: {
            rounds: roundCount,
            workInterval: `${workTime}s`,
            restInterval: `${restTime}s`,
            totalTime: `${Math.floor(totalTime / 60)}:${String(totalTime % 60).padStart(2, '0')}`,
            estimatedCalories: totalCalories
        }
    });
});

/**
 * GET /favorites
 * List all favorite exercises
 */
app.get('/favorites', (req, res) => {
    const allExercises = getAllExercises();
    const favoriteExercises = allExercises.filter(ex => favorites.has(ex.id));

    res.json({
        favorites: favoriteExercises,
        count: favoriteExercises.length
    });
});

/**
 * POST /favorites/:id
 * Add exercise to favorites
 */
app.post('/favorites/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const exercise = getAllExercises().find(ex => ex.id === id);

    if (!exercise) {
        return res.status(404).json({ error: 'Exercise not found' });
    }

    if (favorites.has(id)) {
        return res.status(400).json({ error: 'Exercise already in favorites' });
    }

    favorites.add(id);
    res.status(201).json({
        message: 'Added to favorites',
        exercise
    });
});

/**
 * DELETE /favorites/:id
 * Remove exercise from favorites
 */
app.delete('/favorites/:id', (req, res) => {
    const id = parseInt(req.params.id);

    if (!favorites.has(id)) {
        return res.status(404).json({ error: 'Exercise not in favorites' });
    }

    favorites.delete(id);
    res.json({ message: 'Removed from favorites', exerciseId: id });
});

/**
 * GET /history
 * Get workout history
 */
app.get('/history', (req, res) => {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    res.json({
        history: workoutHistory.slice(-limitNum).reverse(),
        totalWorkouts: workoutHistory.length
    });
});

/**
 * POST /history
 * Save a workout to history
 */
app.post('/history', (req, res) => {
    const { exercises, workoutType, duration, notes } = req.body;

    if (!exercises || !Array.isArray(exercises)) {
        return res.status(400).json({
            error: 'Missing required field: exercises (array)'
        });
    }

    const historyEntry = {
        id: workoutHistory.length + 1,
        timestamp: new Date().toISOString(),
        workoutType: workoutType || 'custom',
        exercises: exercises,
        exerciseCount: exercises.length,
        duration: duration || null,
        notes: notes || '',
        estimatedCalories: exercises.reduce((sum, ex) => sum + (ex.calories || 0), 0)
    };

    // Keep last 100 workouts
    workoutHistory.push(historyEntry);
    if (workoutHistory.length > 100) {
        workoutHistory.shift();
    }

    res.status(201).json({
        message: 'Workout saved to history',
        workout: historyEntry
    });
});

/**
 * DELETE /history
 * Clear workout history
 */
app.delete('/history', (req, res) => {
    const count = workoutHistory.length;
    workoutHistory = [];
    res.json({ message: 'History cleared', deletedCount: count });
});

/**
 * GET /logs
 * Get recent request logs (admin endpoint)
 */
app.get('/logs', (req, res) => {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    res.json({
        logs: requestLogs.slice(-limitNum).reverse(),
        totalLogs: requestLogs.length
    });
});

/**
 * GET /stretches
 * Get stretching/cooldown routine
 * Query params:
 *   - targetArea: legs | upper | arms | back | hips | core | all (default: all)
 *   - count: number of stretches (default: 5)
 */
app.get('/stretches', (req, res) => {
    const { targetArea = 'all', count = 5 } = req.query;

    let stretches = data.stretches || [];

    if (targetArea !== 'all') {
        stretches = stretches.filter(s => s.targetArea === targetArea.toLowerCase());
    }

    const stretchCount = Math.min(stretches.length, Math.max(1, parseInt(count) || 5));
    const shuffled = shuffleArray(stretches);
    const routine = shuffled.slice(0, stretchCount);

    const totalDuration = routine.reduce((sum, s) => sum + s.duration, 0);

    res.json({
        stretches: routine,
        count: routine.length,
        totalDuration: `${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, '0')} min`,
        targetArea: targetArea.toLowerCase()
    });
});

/**
 * GET /nutrition
 * Get nutrition tips
 * Query params:
 *   - category: pre-workout | post-workout | hydration | muscle-building | fat-loss | protein | recovery | supplements | all (default: all)
 */
app.get('/nutrition', (req, res) => {
    const { category = 'all' } = req.query;

    let tips = data.nutritionTips || [];

    if (category !== 'all') {
        tips = tips.filter(t => t.category === category.toLowerCase());
    }

    res.json({
        tips,
        count: tips.length,
        categories: ['pre-workout', 'post-workout', 'hydration', 'muscle-building', 'fat-loss', 'protein', 'recovery', 'supplements']
    });
});

/**
 * GET /cooldown
 * Generate complete cooldown routine (stretches + tips)
 */
app.get('/cooldown', (req, res) => {
    const stretches = shuffleArray(data.stretches || []).slice(0, 5);
    const tips = shuffleArray(data.nutritionTips || []).slice(0, 2);

    const totalDuration = stretches.reduce((sum, s) => sum + s.duration, 0);

    res.json({
        cooldown: {
            stretches,
            nutritionTips: tips
        },
        totalDuration: `${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, '0')} min`,
        message: "Great workout! Remember to hydrate and refuel."
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint (JSON API info)
app.get('/api', (req, res) => {
    res.json({
        message: 'Welcome to the Workout Generator API',
        version: '5.0.0',
        documentation: '/',
        totalExercises: getAllExercises().length,
        customExercises: customExercises.length,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
        endpoints: {
            core: {
                exercises: 'GET /exercises',
                exerciseById: 'GET /exercise/:id',
                randomExercise: 'GET /random-exercise',
                muscles: 'GET /muscles'
            },
            workouts: {
                generateWorkout: 'GET /generate-workout',
                workoutPlan: 'GET /workout-plan',
                superset: 'GET /superset',
                hiit: 'GET /hiit',
                warmUp: 'GET /warm-up'
            },
            user: {
                favorites: 'GET /favorites',
                addFavorite: 'POST /favorites/:id',
                removeFavorite: 'DELETE /favorites/:id',
                addExercise: 'POST /exercises',
                deleteExercise: 'DELETE /exercises/:id'
            },
            meta: {
                stats: 'GET /stats',
                health: 'GET /health'
            }
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏋️ Workout Generator API running on http://localhost:${PORT}`);
});
