# Troubleshooting Guide

## Common Issues and Solutions

### Port Already in Use

**Problem**: Port 4000 or 5173 already in use

**Windows Solution**:
```powershell
# Find process on port 4000
netstat -ano | findstr :4000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in .env
NODE_ENV=development
PORT=4001
```

**Linux/Mac Solution**:
```bash
# Find process
lsof -i :4000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=4001
```

### MongoDB Connection Error

**Problem**: `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`

**Solutions**:

1. Start MongoDB locally:
```bash
# Windows (if installed)
net start MongoDB

# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:7-alpine
```

2. Update connection string in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/streamweaver
```

3. Use MongoDB Atlas (cloud):
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/streamweaver
```

### Redis Connection Error

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solutions**:

1. Start Redis:
```bash
# Windows (WSL)
sudo systemctl start redis-server

# macOS
brew services start redis

# Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

2. Update `.env`:
```
REDIS_URL=redis://localhost:6379
```

### Out of Memory Error

**Problem**: `JavaScript heap out of memory`

**Solutions**:

1. Increase Node.js heap size:
```bash
# Windows
set NODE_OPTIONS=--max-old-space-size=4096
npm run dev

# Linux/Mac
NODE_OPTIONS=--max-old-space-size=4096 npm run dev
```

2. Close unnecessary applications
3. Reduce `BATCH_SIZE` in `.env`
4. Monitor memory usage:
```bash
npm run benchmark
```

### File Upload Fails

**Problem**: "413 Payload Too Large" or "File size exceeds limit"

**Solutions**:

1. Increase `MAX_FILE_SIZE` in `.env`:
```
MAX_FILE_SIZE=10737418240  # 10GB
```

2. Check server memory is sufficient
3. Use streaming upload (frontend should use `react-dropzone`)

### Build Fails with TypeScript Errors

**Problem**: `npm run build` shows type errors

**Solutions**:

1. Fix TypeScript errors:
```bash
npm run tsc
```

2. Update TypeScript:
```bash
npm install -D typescript@latest
```

3. Check Node version compatibility:
```bash
node --version  # Should be v20+
```

### ESLint/Prettier Issues

**Problem**: Linting or formatting fails

**Solutions**:

1. Auto-fix issues:
```bash
npm run lint:fix
npm run format
```

2. Check configuration:
```bash
cat backend_backup/.eslintrc.json
cat backend_backup/.prettierrc.json
```

3. Reinstall packages:
```bash
npm ci --workspace=@streamweaver/backend
```

### Docker Issues

**Problem**: Docker container fails to start

**Solutions**:

1. Check Docker is running:
```bash
docker --version
docker ps
```

2. Check logs:
```bash
docker-compose logs backend
docker-compose logs mongodb
```

3. Clean up and rebuild:
```bash
docker-compose down -v
docker-compose up --build
```

4. Check ports are available:
```bash
docker-compose ps
```

### WebSocket Connection Failed

**Problem**: "WebSocket connection failed" in browser console

**Solutions**:

1. Check backend is running:
```bash
curl http://localhost:4000/health
```

2. Verify WebSocket server is listening:
```
WS_PORT=4001
```

3. Check CORS settings in `.env`:
```
CORS_ORIGINS=http://localhost:5173
```

4. Check network connectivity
5. Try different browser/clear cache

### Slow Performance

**Problem**: Application is slow or sluggish

**Solutions**:

1. Check database indexes:
```bash
mongo streamweaver
db.pipelines.getIndexes()
```

2. Monitor resource usage:
```bash
# Windows Task Manager
tasklist

# Linux
top

# Docker
docker stats
```

3. Optimize batch size in `.env`:
```
BATCH_SIZE=5000  # Adjust up for better memory
```

4. Enable caching in Redis
5. Profile with benchmark:
```bash
npm run benchmark
```

### Debugging Backend

**Enable verbose logging**:
```
LOG_LEVEL=debug
NODE_DEBUG=mongodb,socket.io
```

**Use Node debugger**:
```bash
node --inspect-brk=9229 dist/index.js
# Then visit: chrome://inspect
```

### Debugging Frontend

**Browser DevTools**:
- F12 or Ctrl+Shift+I to open
- Console tab for errors
- Network tab for API calls
- React DevTools extension for React component inspection

**Enable API logging**:
```
VITE_API_DEBUG=true
```

### Still Having Issues?

1. Check GitHub Issues for similar problems
2. Review logs:
   - Backend: `backend_backup/logs/`
   - Docker: `docker-compose logs`
3. Enable debug mode and collect logs
4. Ask for help in discussions or create an issue

## Getting Help

- Check this troubleshooting guide
- Review [SETUP.md](./SETUP.md)
- Check [API documentation](./docs/api-documentation.md)
- Create a GitHub issue with:
  - Error message
  - Steps to reproduce
  - Environment (OS, Node version, etc.)
  - Relevant logs
  - Screenshots if applicable
