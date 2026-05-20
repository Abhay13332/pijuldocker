#!/usr/bin/env bash

# Define paths for easy maintenance
LOCAL_BASE="/home/abhay/tmptasks/pijulserv"
CONTAINER_NAME="pijulserv-app"

# Check if an argument (specific file/folder) is provided
if [ -n "$1" ]; then
    TARGET_PATH="$1"
    
    # 1. Ensure the target exists locally first
    if [ ! -e "$TARGET_PATH" ]; then
        echo "Error: Local path '$TARGET_PATH' does not exist."
        exit 1
    fi
    
    # 2. Convert to an absolute path to resolve any relative nesting (like ../ or ./)
    ABS_PATH=$(realpath "$TARGET_PATH")
    
    # 3. Smart Path Extraction: Extract everything from 'frontend' onwards
    if [[ "$ABS_PATH" == *"frontend"* ]]; then
        # Strip everything before 'frontend'
        REL_CONTAINER_PATH=$(echo "$ABS_PATH" | sed 's|.*/frontend|frontend|')
    else
        # Fallback if 'frontend' isn't in the path name (e.g. file is outside the project tree)
        REL_CONTAINER_PATH="frontend/$(basename "$ABS_PATH")"
    fi
    
    CONTAINER_DEST="/app/$REL_CONTAINER_PATH"
    
    echo "Resolved local path: $ABS_PATH"
    echo "Resolved container path: $CONTAINER_DEST"
    
    # Copy specific file/folder directly to its calculated container destination
    podman cp "$ABS_PATH" "${CONTAINER_NAME}:${CONTAINER_DEST}"
else
    # Navigate to the workspace for default full copy
    cd "$LOCAL_BASE" || exit 1
    echo "No argument provided. Copying entire frontend folder..."
    podman cp frontend "${CONTAINER_NAME}:/app/frontend"
fi

# Run the build process using the working directory flag (-w)
echo "Building the frontend..."
podman exec -w /app/frontend "$CONTAINER_NAME" npm run build

# Restart the container to apply changes
echo "Restarting container..."
podman restart "$CONTAINER_NAME"

echo "Done!"
