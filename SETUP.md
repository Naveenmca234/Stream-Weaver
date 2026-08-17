# StreamWeaver Development Setup Guide

## Prerequisites

- **Node.js**: v20+ (LTS recommended)
- **npm**: v10+
- **Docker & Docker Compose**: Latest version (for containerized setup)
- **MongoDB**: v7+ (local or Docker)
- **Redis**: v7+ (local or Docker)

## Quick Start

### 1. Local Development (Without Docker)

```bash
# Clone the repository
git clone <repository-url>
cd StreamWeaver

# Install dependencies
npm install

# Setup environment variables
cp backend_backup/.env.example backend_backup/.env
cp client/.env.example client/.env

# Edit the .env files with your configuration
nano backend_backup/.env
nano client/.env

# Start MongoDB (if not running)
# Make sure MongoDB is running on localhost:27017

# Start Redis (if not running)
# Make sure Redis is running on localhost:6379

# Start development servers
npm run dev
```

The frontend will be available at `http://localhost:5173` and backend at `http://localhost:4000`.

### 2. Docker Compose Setup (Recommended)

```bash
# Create environment file for Docker
cat > .env.docker << EOF
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=streamweaver123
REDIS_PASSWORD=redis123
NODE_ENV=development
JWT_SECRET=your-dev-secret-key
JWT_REFRESH_SECRET=your-dev-refresh-key
EOF

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

Services will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- MongoDB Admin: `http://localhost:8080` (Adminer)
- Redis: `redis://localhost:6379`

## Development Commands

```bash
# Development mode (both frontend and backend)
npm run dev

# Build for production
npm run build

# Run backend tests
npm test --workspace=@streamweaver/backend

# Lint backend code
npm run lint --workspace=@streamweaver/backend

# Format code
npm run format --workspace=@streamweaver/backend

# Run benchmarks
npm run benchmark --workspace=@streamweaver/backend
```

## Environment Configuration

### Backend Environment Variables

See `backend_backup/.env.example` for all available options:

**Critical Variables:**
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret (change in production!)
- `CLIENT_URL`: Frontend URL for CORS

**Performance Tuning:**
- `BATCH_SIZE`: ETL batch processing size (default: 5000)
- `SANDBOX_MEMORY`: Isolated-vm memory limit in MB (default: 128)
- `SANDBOX_TIMEOUT`: Sandbox execution timeout in ms (default: 5000)

### Frontend Environment Variables

See `client/.env.example`:
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket server URL

## Database Setup

### MongoDB

```bash
# Create database and collections
mongo mongodb://localhost:27017/streamweaver

# Create indexes for better performance
db.pipelines.createIndex({ userId: 1, createdAt: -1 })
db.runs.createIndex({ pipelineId: 1, createdAt: -1 })
db.datasets.createIndex({ userId: 1, uploadedAt: -1 })
```

### Redis

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Monitor Redis
redis-cli monitor
```

## Project Structure

```
StreamWeaver/
├── backend_backup/          # Backend source code
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── models/           # MongoDB schemas
│   │   ├── services/         # Business logic
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API routes
│   │   ├── sandbox/          # Isolated VM sandbox
│   │   ├── pipeline/         # ETL engine
│   │   └── queue/            # Job queue (BullMQ)
│   ├── package.json
│   └── tsconfig.json
├── client/                   # Frontend source code
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   └── utils/            # Utilities
│   ├── package.json
│   └── vite.config.js
├── docs/                     # Documentation
├── sample-data/              # Sample CSV/JSON files
└── docker-compose.yml        # Docker Compose configuration
```

## Production Deployment

### Docker Build

```bash
# Build Docker images
docker build -t streamweaver-backend -f Dockerfile --target backend-runtime .
docker build -t streamweaver-frontend -f Dockerfile --target frontend-runtime .

# Push to registry
docker push streamweaver-backend
docker push streamweaver-frontend
```

### Kubernetes Deployment

```bash
# Create deployment
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods
kubectl logs <pod-name>
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port
lsof -i :4000  # Find process on port 4000
kill -9 <PID>  # Kill the process
```

### MongoDB Connection Error

```bash
# Check MongoDB is running
mongo --eval "db.adminCommand('ping')"

# Clear old connections
mongo admin --eval "db.getCollectionNames()"
```

### Out of Memory

Increase Node.js heap size:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run dev
```

## Performance Optimization

1. **Batch Processing**: Adjust `BATCH_SIZE` for optimal memory usage
2. **Streaming**: All file uploads use Node streams to minimize memory
3. **Caching**: Redis caches frequently accessed data
4. **Virtualization**: Frontend uses `react-window` for large datasets

## Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Static code analysis
- **Prettier**: Code formatting
- **Pre-commit hooks**: Automated checks (setup recommended)

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Open a Pull Request

## Getting Help

- Check documentation in `docs/` folder
- Review issue tracker on GitHub
- Contact team lead for guidance

## License

[Your License Here]
