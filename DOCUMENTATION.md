# Documentation for Emergency Alert Application

## Database Setup Instructions

### Initial Database Creation

The database is automatically initialized when you start Docker Compose:

```bash
docker-compose up -d
```

The PostgreSQL service will automatically run the SQL script at `docker/init.sql` which creates:
- All tables (users, refresh_tokens, reputation_events)
- Indexes for performance
- PostGIS extension for geolocation

### Accessing the Database

#### Using pgAdmin (Web UI)
- URL: http://localhost:5050
- Email: admin@example.com
- Password: admin
- Server Name: postgres
- Host: postgres
- Port: 5432
- Username: postgres
- Password: postgres

#### Using psql (CLI)
```bash
docker exec -it app_alertas_postgres psql -U postgres -d app_alertas
```

## API Documentation

### Authentication Endpoints

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe",
  "phone": "+59176123456",
  "id_card_base64": "base64_encoded_image"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "identity_verified": false
  }
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response: Same as Register
```

#### Refresh Token
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response: Same as Register
```

#### Verify Identity
```bash
POST /api/auth/verify-identity
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "id_card_base64": "base64_encoded_image"
}

Response:
{
  "verified": true,
  "ciHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "message": "Identity verified successfully"
}
```

#### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer {accessToken}

Response:
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

### User Endpoints

#### Get User Profile
```bash
GET /api/users/:id

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "John Doe",
  "email": "user@example.com",
  "phone": "+59176123456",
  "identity_verified": true,
  "reputation_score": 100,
  "role": "citizen"
}
```

#### Update User
```bash
PUT /api/users/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "phone": "+59176123457"
}

Response: Updated user object
```

## Google Cloud Vision API Setup

### Prerequisites
1. Google Cloud project with Vision API enabled
2. Service account with appropriate permissions
3. JSON credentials file

### Configuration Steps

1. Create a Google Cloud project
2. Enable the Vision API
3. Create a service account
4. Download the JSON credentials file
5. Set environment variable:
   ```bash
   export GOOGLE_CLOUD_VISION_CREDENTIALS=/path/to/credentials.json
   ```

### Identity Verification Flow

The verification process:
1. User captures/uploads ID card image
2. Image is converted to Base64
3. Sent to backend `/api/auth/verify-identity`
4. Google Vision API extracts text via OCR
5. CI number is extracted and hashed (SHA-256)
6. Hash is checked against database to prevent duplicates
7. User is marked as `identity_verified: true`

## Deployment Guide

### Backend Deployment

#### Using Docker

1. Build the Docker image:
```bash
docker build -f Dockerfile.backend -t app-alertas-backend .
```

2. Run the container:
```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  app-alertas-backend
```

#### Using Heroku

1. Create Heroku app:
```bash
heroku create app-alertas-backend
```

2. Add PostgreSQL addon:
```bash
heroku addons:create heroku-postgresql:standard-0 -a app-alertas-backend
```

3. Deploy:
```bash
git push heroku main
```

### Mobile Deployment

#### Android

1. Build APK:
```bash
eas build --platform android
```

2. Submit to Google Play Store:
```bash
eas submit --platform android
```

#### iOS

1. Build IPA:
```bash
eas build --platform ios
```

2. Submit to App Store:
```bash
eas submit --platform ios
```

## Troubleshooting

### Common Issues

#### "Cannot connect to database"
- Ensure PostgreSQL container is running: `docker ps`
- Check DATABASE_URL in .env
- Verify network connectivity

#### "JWT token invalid"
- Tokens expire after 15 minutes
- Use refresh token to get new access token
- Check JWT_SECRET environment variable

#### "Identity verification fails"
- Verify Google Cloud credentials are correct
- Check Vision API is enabled in GCP
- Ensure ID card image is clear and readable

#### "Camera permission denied"
- Grant camera permissions in app settings
- On mobile, check app permissions in OS settings

## Performance Optimization

### Database Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';

-- Vacuum for table maintenance
VACUUM ANALYZE users;
```

### Caching Strategy
- JWT tokens cached in expo-secure-store
- User profiles cached in Zustand store
- API responses cached with axios

### Load Balancing
For production, consider:
- Multiple backend instances
- Redis for session management
- CDN for static assets
- Database read replicas

## Security Considerations

1. **Environment Variables**: Never commit .env file
2. **JWT Secrets**: Use strong, random secrets (min 32 chars)
3. **Password Storage**: Always hash with bcrypt (minimum 10 rounds)
4. **CI Hash**: SHA-256 hash before storage
5. **HTTPS**: Use in production
6. **CORS**: Configure appropriately
7. **Rate Limiting**: Implement for API endpoints
8. **Input Validation**: Validate all user inputs with class-validator

## Monitoring and Logging

### Backend Logging
```typescript
// Enable logging in app.module.ts
logging: process.env.NODE_ENV === 'development'
```

### Database Monitoring
```bash
# Connect to PostgreSQL
docker exec -it app_alertas_postgres psql -U postgres -d app_alertas

# View active connections
SELECT * FROM pg_stat_activity;

# View table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```
