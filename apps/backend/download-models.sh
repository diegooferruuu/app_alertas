#!/bin/bash
# Download face-api.js models for face recognition
# Run from apps/backend directory: bash download-models.sh

MODELS_DIR="./models"
BASE_URL="https://raw.githubusercontent.com/vladmandic/face-api/master/model"

mkdir -p "$MODELS_DIR"

echo "Downloading face detection models..."

FILES=(
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

for FILE in "${FILES[@]}"; do
  if [ ! -f "$MODELS_DIR/$FILE" ]; then
    echo "Downloading $FILE..."
    curl -L "$BASE_URL/$FILE" -o "$MODELS_DIR/$FILE" --progress-bar
  else
    echo "  $FILE already exists, skipping."
  fi
done

echo "Done! Models are in $MODELS_DIR"
