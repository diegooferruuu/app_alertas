-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla principal de usuarios
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,

  -- Verificación de identidad
  identity_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  ci_hash               VARCHAR(64) UNIQUE,      -- SHA-256 del número de carnet
  identity_verified_at  TIMESTAMPTZ,

  -- Sistema de reputación
  reputation_score      INTEGER NOT NULL DEFAULT 100,
  is_suspended          BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_at          TIMESTAMPTZ,
  suspension_reason     TEXT,

  -- Push notifications
  push_token            VARCHAR(255),
  push_token_updated_at TIMESTAMPTZ,

  -- Ubicación (PostGIS)
  last_location         GEOGRAPHY(POINT, 4326),
  last_location_at      TIMESTAMPTZ,

  -- Rol
  role                  VARCHAR(20) NOT NULL DEFAULT 'citizen'
                        CHECK (role IN ('citizen', 'admin')),

  -- Auditoría
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ          -- soft delete
);

-- Tabla de refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 del token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de reputación (auditoría de cambios de score)
CREATE TABLE reputation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,             -- positivo o negativo
  reason      VARCHAR(100) NOT NULL,        -- 'false_report', 'confirmed_report', etc.
  reference_id UUID,                        -- id del caso relacionado
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_users_email         ON users(email);
CREATE INDEX idx_users_ci_hash       ON users(ci_hash);
CREATE INDEX idx_users_last_location ON users USING GIST(last_location);
CREATE INDEX idx_users_push_token    ON users(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
