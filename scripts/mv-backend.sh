#!/usr/bin/bash

# 1. Mount the container and sync files safely
podman unshare sh -c '
  mnt=$(podman mount pijulserv-app)
  
  # Sync files without trying to delete the excluded directory roots
  rsync -av --delete --exclude="node_modules" --exclude="pijul-reader" backend/ "$mnt/app/backend/"
  
  # Sync entrypoint script
  rsync -av --delete entrypoint.sh "$mnt/app/entrypoint.sh"
  
  # CRITICAL: Make sure the entrypoint is executable inside the container
  chmod +x "$mnt/app/entrypoint.sh"

  podman umount pijulserv-app
'

# podman exec -w /app/backend pijulserv-app npm install
# 2. Restart the container FIRST so the new entrypoint/code loads
podman restart pijulserv-app

# 3. Run npm install only AFTER the container is safely up and running
