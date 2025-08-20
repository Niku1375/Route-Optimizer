# 🚀 Logistics Routing System - Setup Guide

## ✅ **CORRECT WAY to Handle API Keys**

### **Step 1: Create Your Environment File**

1. Copy the template:
```bash
cp .env.example .env.development
```

2. **PASTE YOUR API KEYS HERE** (in the .env.development file):
```bash
# Replace these with your actual values:
GOOGLE_MAPS_API_KEY=your_actual_google_maps_key_here
MAPBOX_ACCESS_TOKEN=your_actual_mapbox_token_here
GRAPHHOPPER_API_KEY=your_actual_graphhopper_key_here

# Database (if using local setup)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=logistics_routing_db
DATABASE_USER=logistics_user
DATABASE_PASSWORD=your_secure_password_here

# Redis (if using local setup)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

### **Step 2: The System Will Automatically Load Your Keys**

The system uses `src/config/environment.ts` to securely load your API keys from environment variables. **Never paste keys directly in code files!**

## 🔐 **Security Benefits**

✅ **API keys are NOT committed to Git**
✅ **Different keys for dev/staging/production**
✅ **Easy key rotation without code changes**
✅ **Team members use their own keys**

## 🛠️ **Quick Setup Commands**

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment file
cp .env.example .env.development
# Edit .env.development with your API keys

# 3. Start databases (using Docker)
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=logistics_routing_db \
  -e POSTGRES_USER=logistics_user \
  -e POSTGRES_PASSWORD=your_password \
  postgres:14

docker run -d --name redis -p 6379:6379 redis:7-alpine

# 4. Run database migrations
npm run migrate

# 5. Start the application
npm run dev
```

## 📝 **Where to Paste Your API Keys**

**✅ SAFE LOCATIONS:**
- `.env.development` (for development)
- `.env.production` (for production)
- Environment variables in your hosting platform
- CI/CD pipeline secrets

**❌ NEVER PASTE IN:**
- `DEPLOYMENT_CONFIG.md`
- Any `.ts` or `.js` files
- README files
- Any file that gets committed to Git

## 🔄 **How the System Uses Your Keys**

```typescript
// The system automatically loads your keys like this:
import { config } from './config/environment';

// Your Google Maps key is available as:
const googleMapsKey = config.apis.googleMaps.apiKey;

// Your Mapbox token is available as:
const mapboxToken = config.apis.mapbox.accessToken;
```

## 🎯 **Next Steps**

1. **Create your `.env.development` file**
2. **Paste your API keys in that file only**
3. **Test the configuration**: `npm run dev`
4. **The system will validate your keys on startup**

This approach keeps your API keys secure while making them easily accessible to your application!

---

**Remember**: The `DEPLOYMENT_CONFIG.md` file is just documentation - it shows you what APIs are needed, but your actual keys go in the `.env` files.