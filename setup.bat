@echo off
REM StreamWeaver Setup Script for Windows

echo.
echo 🚀 StreamWeaver Development Setup
echo ==================================
echo.

REM Check Node.js version
echo ✓ Checking Node.js version...
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   Node.js %NODE_VERSION% found
echo.

REM Check npm version
echo ✓ Checking npm version...
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo   npm %NPM_VERSION% found
echo.

REM Create environment files if they don't exist
echo ✓ Setting up environment files...
if not exist "backend_backup\.env" (
    copy backend_backup\.env.example backend_backup\.env
    echo   Created backend_backup\.env
)

if not exist "client\.env" (
    copy client\.env.example client\.env
    echo   Created client\.env
)
echo.

REM Install dependencies
echo ✓ Installing dependencies...
call npm install
echo.

REM Create uploads directory
echo ✓ Creating uploads directory...
if not exist "backend_backup\uploads" mkdir backend_backup\uploads
echo   Created uploads directory
echo.

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit environment files:
echo    - backend_backup\.env
echo    - client\.env
echo.
echo 2. Start development server:
echo    npm run dev
echo.
echo 3. Or use Docker Compose:
echo    docker-compose up -d
echo.
echo 📚 See SETUP.md for detailed instructions
echo.
pause
