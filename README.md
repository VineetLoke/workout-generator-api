# Workout Generator API

A simple REST API that generates random workout exercises based on muscle group and difficulty level.

## Installation

```bash
# Navigate to project directory
cd workout-generator-api

# Install dependencies
npm install

# Start the server
npm start
```

## API Endpoints

### Generate Workout
```
GET /generate-workout
```

Returns 3 random exercises based on optional filters.

**Query Parameters:**
| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `muscle` | string | `chest`, `back`, `legs` | Filter by muscle group |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` | Filter by difficulty |

**Examples:**

```bash
# Get 3 random exercises (no filter)
curl http://localhost:3000/generate-workout

# Get chest exercises
curl http://localhost:3000/generate-workout?muscle=chest

# Get beginner leg exercises
curl http://localhost:3000/generate-workout?muscle=legs&difficulty=beginner
```

**Sample Response:**
```json
{
  "workout": [
    {
      "id": 2,
      "name": "Push-ups",
      "muscle": "chest",
      "difficulty": "beginner",
      "description": "Classic bodyweight exercise performed in a plank position",
      "equipment": "none"
    },
    {
      "id": 16,
      "name": "Lunges",
      "muscle": "legs",
      "difficulty": "beginner",
      "description": "Step forward into a lunge position, alternating legs",
      "equipment": "none"
    },
    {
      "id": 10,
      "name": "Lat Pulldowns",
      "muscle": "back",
      "difficulty": "beginner",
      "description": "Pull a cable bar down to chest level while seated",
      "equipment": "cable machine"
    }
  ],
  "count": 3,
  "filters": {
    "muscle": "all",
    "difficulty": "beginner"
  }
}
```

### Health Check
```
GET /health
```

Returns server status.

## Configuration

Create a `.env` file to configure the port (default: 3000):

```
PORT=3000
```

## License

MIT
