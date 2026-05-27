# Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd "Proyecto de grado/Version 1"

# Install dependencies
pnpm install

# Or with npm
npm install
```

### Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values (or use defaults for local development)
```

### Step 3: Start PostgreSQL

```bash
# Start PostgreSQL and pgAdmin with Docker
docker-compose up -d

# Verify it's running
docker ps
```

### Step 4: Start the Backend

```bash
cd apps/backend

# Install backend dependencies
pnpm install

# Start development server
pnpm run start:dev

# Backend runs at http://localhost:3000/api
```

### Step 5: Start the Mobile App

In a new terminal:

```bash
cd apps/mobile

# Install mobile dependencies
pnpm install

# Start Expo development server
pnpm run start

# Scan QR code with Expo Go app or press 'i' for iOS / 'a' for Android
```

## ✅ Testing the Setup

### Test Backend API

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "full_name": "Test User",
    "phone": "+59176123456",
    "id_card_base64": "placeholder"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Test Database

Access pgAdmin at http://localhost:5050:
- Email: admin@example.com
- Password: admin

Add a new server:
- Host: postgres
- Username: postgres
- Password: postgres

## 📚 Useful Commands

```bash
# Root level commands
pnpm run lint              # Lint all packages
pnpm run format            # Format all code
pnpm run dev:backend       # Start backend
pnpm run dev:mobile        # Start mobile

# Backend specific
cd apps/backend
pnpm run build             # Build production
pnpm run test              # Run tests
pnpm run start:prod        # Run production build

# Mobile specific
cd apps/mobile
pnpm run ios               # Run on iOS simulator
pnpm run android           # Run on Android emulator
pnpm run web               # Run web version

# Database
docker-compose logs -f postgres    # View PostgreSQL logs
docker exec -it app_alertas_postgres psql -U postgres -d app_alertas
```

## 🛠️ Common Issues

### Port 5432 Already in Use
```bash
# Stop the existing PostgreSQL
docker-compose down

# Or use a different port
docker-compose -f docker-compose.yml down
```

### Can't Connect to Backend from Mobile
1. Check that backend is running
2. Update MOBILE_API_URL in .env
3. Ensure devices are on same network

### Module Not Found Errors
```bash
# Reinstall dependencies
pnpm install

# Clear cache
pnpm store prune
```

## 📱 Next Steps

1. **Add Backend Features**
   - Alerts management
   - Real-time notifications
   - Location tracking

2. **Add Mobile Features**
   - Alert feed
   - Map view
   - Settings

3. **Configure Google Cloud Vision**
   - Get API credentials
   - Update GOOGLE_CLOUD_VISION_CREDENTIALS in .env

4. **Deploy**
   - Backend: Docker, Heroku, AWS
   - Mobile: EAS Build, Google Play, App Store

## 📖 Documentation

- [Full README](./README.md)
- [Database Documentation](./DOCUMENTATION.md)
- [NestJS Docs](https://docs.nestjs.com/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)

## 🆘 Need Help?

Check the [DOCUMENTATION.md](./DOCUMENTATION.md) file for:
- Detailed API documentation
- Deployment guides
- Troubleshooting
- Performance optimization
