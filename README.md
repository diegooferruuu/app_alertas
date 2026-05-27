# Emergency Alert Application - Monorepo

A comprehensive monorepo for a mobile emergency alert application with NestJS backend, React Native + Expo mobile app, and shared TypeScript interfaces.

## Project Structure

```
├── apps/
│   ├── backend/           # NestJS backend application
│   │   └── src/
│   │       ├── auth/      # Authentication module
│   │       ├── users/     # Users module
│   │       ├── verification/  # Identity verification
│   │       └── common/    # Shared utilities
│   └── mobile/            # React Native + Expo mobile app
│       └── src/
│           ├── screens/   # UI screens
│           ├── services/  # API services
│           ├── store/     # Zustand state management
│           └── hooks/     # Custom React hooks
├── packages/
│   └── shared/            # Shared TypeScript interfaces
└── docker/                # Docker configuration
```

## Prerequisites

- Node.js 18+ and npm or pnpm
- PostgreSQL 14+ with PostGIS
- Docker & Docker Compose (optional)
- Expo CLI (`npm install -g expo-cli`)
- Google Cloud Vision API credentials

## Installation

### 1. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and update with your configuration:
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- Database credentials
- JWT secrets
- Google Cloud Vision credentials
- Mobile API URL

### 3. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL with PostGIS enabled
- pgAdmin for database management (http://localhost:5050)

The database will be automatically initialized with the schema from `docker/init.sql`.

### 4. Verify Database Connection

Check that PostgreSQL is running:
```bash
docker ps
```

Access pgAdmin at http://localhost:5050 with:
- Email: admin@example.com
- Password: admin

## Development

### Backend Development

```bash
cd apps/backend

# Install dependencies
npm install

# Start development server with hot reload
npm run start:dev

# The backend will be available at http://localhost:3000/api
```

Available endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-identity` - Identity verification with ID card
- `GET /api/auth/me` - Get current user profile
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user

### Mobile Development

```bash
cd apps/mobile

# Install dependencies
npm install

# Start Expo development server
npm run start

# For iOS (requires macOS)
npm run ios

# For Android
npm run android

# For web
npm run web
```

The mobile app will handle the navigation flow:
1. **Unauthenticated**: Login/Register screens
2. **Authenticated but not verified**: Identity verification with camera
3. **Fully verified**: Main app screens

## Features

### Backend Features

#### Authentication
- JWT-based authentication with access and refresh tokens
- Passport.js with local and JWT strategies
- Password hashing with bcrypt
- Token blacklisting support

#### User Management
- User registration and profile management
- Role-based access control (citizen/admin)
- User suspension and reputation scoring

#### Identity Verification
- Google Cloud Vision API integration for OCR
- CI number extraction from ID cards
- SHA-256 hashing of CI numbers to prevent duplicates
- Identity verification status tracking

#### Database Features
- PostgreSQL with PostGIS for geolocation
- Soft deletes support
- Comprehensive audit trails
- Reputation system with event tracking

### Mobile Features

#### Authentication
- Secure token storage with expo-secure-store
- Automatic token refresh
- Session management

#### Identity Verification
- Camera integration with expo-camera
- Image upload from gallery
- Base64 encoding for transmission

#### State Management
- Zustand for simplified state management
- Axios with interceptors for API calls
- Error handling and retry logic

## Configuration Files

### Database
- `docker-compose.yml` - PostgreSQL and pgAdmin services
- `docker/init.sql` - Database schema initialization

### Backend
- `apps/backend/package.json` - NestJS dependencies
- `apps/backend/tsconfig.json` - TypeScript configuration
- `apps/backend/src/app.module.ts` - Main app module

### Mobile
- `apps/mobile/app.json` - Expo configuration
- `apps/mobile/package.json` - React Native dependencies
- `apps/mobile/tsconfig.json` - TypeScript configuration

### Shared
- `packages/shared/src/index.ts` - Shared TypeScript interfaces
- `pnpm-workspace.yaml` - pnpm workspace configuration

## Database Schema

### Tables

#### users
Main user table with:
- Authentication data (email, password hash)
- Identity verification (CI hash, verification status)
- Reputation system (score, suspension)
- Push notifications (token)
- Location data (PostGIS point)
- Audit fields (created_at, updated_at, deleted_at)

#### refresh_tokens
Refresh token storage with:
- Token hash (SHA-256)
- Expiration time
- Revocation status

#### reputation_events
Audit trail for reputation changes with:
- User reference
- Delta (positive/negative score change)
- Reason for change
- Reference to related case

## Environment Variables

```
# Backend
BACKEND_PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_alertas
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=app_alertas

# JWT
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your_refresh_secret_key_here_min_32_chars
JWT_REFRESH_EXPIRATION=7d

# Google Cloud Vision API
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_VISION_CREDENTIALS=/path/to/credentials.json

# Mobile
MOBILE_API_URL=http://localhost:3000/api
```

## Testing

### Backend Tests
```bash
cd apps/backend
npm run test
npm run test:watch
npm run test:cov
```

### Linting
```bash
# Lint all packages
pnpm run lint

# Format all packages
pnpm run format
```

## Deployment

### Backend Deployment

1. Build the project:
```bash
npm run build
```

2. Set production environment variables

3. Run migrations:
```bash
npm run typeorm migration:run
```

4. Start the application:
```bash
npm run start:prod
```

### Mobile Deployment

1. For iOS:
```bash
expo build:ios
```

2. For Android:
```bash
expo build:android
```

See [Expo documentation](https://docs.expo.dev/build/setup/) for detailed deployment instructions.

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `docker ps`
- Check environment variables in `.env`
- Ensure port 5432 is not in use

### Token Expiration
- Access tokens expire after 15 minutes
- Use refresh token to obtain new access token
- Refresh tokens expire after 7 days

### Google Cloud Vision Issues
- Verify credentials file path in `.env`
- Ensure project has Vision API enabled
- Check service account permissions

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and tests
4. Submit a pull request

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
