require('dotenv').config();
const express = require('express');
const cors = require('cors');
const data = require('./data.json');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Workout Generator API',
        version: '2.0.0',
        totalExercises: data.exercises.length,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
        endpoints: {
            exercises: 'GET /exercises?muscle=chest&difficulty=beginner&equipment=dumbbells&page=1&limit=10',
            generateWorkout: 'GET /generate-workout?muscle=chest&difficulty=beginner&count=5',
            health: 'GET /health'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏋️ Workout Generator API running on http://localhost:${PORT}`);
});
