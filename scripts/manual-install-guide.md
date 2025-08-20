# Manual Database Installation Guide

## PostgreSQL Installation

### Windows:
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer and follow these settings:
   - Port: 5432
   - Username: postgres
   - Password: (choose a strong password)
3. After installation, create the logistics database:
   ```cmd
   psql -U postgres
   CREATE DATABASE logistics_routing_dev;
   CREATE USER logistics_user WITH PASSWORD 'dev_password';
   GRANT ALL PRIVILEGES ON DATABASE logistics_routing_dev TO logistics_user;
   \q
   ```

### Alternative - Using Chocolatey:
```cmd
choco install postgresql
```

## Redis Installation

### Windows:
1. Download Redis from: https://github.com/microsoftarchive/redis/releases
2. Extract and run redis-server.exe
3. Redis will start on port 6379

### Alternative - Using Chocolatey:
```cmd
choco install redis-64
```

### Alternative - Using WSL2:
```bash
# In WSL2 terminal
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

## Verification

Test your installations:

### PostgreSQL:
```cmd
psql -h localhost -p 5432 -U logistics_user -d logistics_routing_dev
```

### Redis:
```cmd
redis-cli ping
# Should return: PONG
```

## Environment Configuration

Update your `.env.development` file with your actual credentials if different from defaults.