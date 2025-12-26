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
 * GET /generate-workout
 * Query params:
 *   - muscle: chest | back | legs (optional)
 *   - difficulty: beginner | intermediate | advanced (optional)
 * Returns 3 random exercises matching the filters
 */
app.get('/generate-workout', (req, res) => {
  const { muscle, difficulty } = req.query;
  
  // Validate muscle parameter if provided
  const validMuscles = ['chest', 'back', 'legs'];
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
  
  // Shuffle and pick up to 3 exercises
  const shuffled = shuffleArray(filteredExercises);
  const workout = shuffled.slice(0, Math.min(3, shuffled.length));
  
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
    endpoints: {
      generateWorkout: 'GET /generate-workout?muscle=chest&difficulty=beginner',
      health: 'GET /health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏋️ Workout Generator API running on http://localhost:${PORT}`);
});
