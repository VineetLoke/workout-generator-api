# Workout Generator API

A REST API that generates random workout exercises based on muscle group and difficulty level.

## Installation

```bash
cd workout-generator-api
npm install
npm start
```

## API Endpoints

### GET /exercises
List all exercises with filtering and pagination.

| Parameter | Type | Options | Default |
|-----------|------|---------|---------|
| `muscle` | string | `chest`, `back`, `legs`, `shoulders`, `arms`, `core` | all |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` | all |
| `equipment` | string | any equipment name | all |
| `page` | number | 1+ | 1 |
| `limit` | number | 1-50 | 10 |

```bash
curl "http://localhost:3000/exercises?muscle=chest&page=1&limit=5"
```

---

### GET /generate-workout
Generate random exercises for a workout.

| Parameter | Type | Options | Default |
|-----------|------|---------|---------|
| `muscle` | string | `chest`, `back`, `legs`, `shoulders`, `arms`, `core` | all |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` | all |
| `count` | number | 1-10 | 3 |

```bash
# Get 5 beginner chest exercises
curl "http://localhost:3000/generate-workout?muscle=chest&difficulty=beginner&count=5"
```

---

### GET /health
Server health check.

## Configuration

```env
PORT=3000
```

## Live API

```
https://workout-generator-api-phig.onrender.com
```

## License

MIT
