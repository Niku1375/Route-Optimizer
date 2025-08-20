@echo off
echo Setting up development databases for Logistics Routing System...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker found
echo.

REM Start the databases
echo 🚀 Starting PostgreSQL and Redis containers...
docker-compose -f docker-compose.dev.yml up -d

if %errorlevel% neq 0 (
    echo ERROR: Failed to start database containers
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for databases to be ready...
timeout /t 10 /nobreak >nul

REM Check if containers are running
docker ps --filter "name=logistics-postgres-dev" --filter "status=running" --quiet >nul
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL container is not running
    docker logs logistics-postgres-dev
    pause
    exit /b 1
)

docker ps --filter "name=logistics-redis-dev" --filter "status=running" --quiet >nul
if %errorlevel% neq 0 (
    echo ERROR: Redis container is not running
    docker logs logistics-redis-dev
    pause
    exit /b 1
)

echo.
echo ✅ Database Setup Complete!
echo.
echo 📊 Services Running:
echo   - PostgreSQL: localhost:5432
echo   - Redis: localhost:6379
echo   - PgAdmin: http://localhost:8080 (admin@logistics.local / admin123)
echo.
echo 🔧 Connection Details:
echo   Database: logistics_routing_dev
echo   Username: logistics_user
echo   Password: dev_password
echo.
echo 📝 Next Steps:
echo   1. Run: npm install
echo   2. Run: npm run migrate (to create database tables)
echo   3. Run: npm run dev (to start the application)
echo.
pause