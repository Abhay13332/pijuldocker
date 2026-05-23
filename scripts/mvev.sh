#! /usr/bin/bash
podman unshare sh -c '
  mnt=$(podman mount pijulserv-app)
  rsync -av --delete --exclude="node_modules" --exclude="pijul-reader" backend/ "$mnt/app/backend/"
   rsync -av --delete --exclude="node_modules" frontend/ "$mnt/app/frontend/"
   rsync -av --delete entrypoint.sh "$mnt/app/entrypoint.sh"
  podman umount pijulserv-app
'
# podman unshare chown -R 0:0 $(podman mount pijulserv-app)/app/backend
podman exec -w /app/backend pijulserv-app npm install
podman exec -w /app/frontend pijulserv-app npm install
podman exec -w /app/frontend pijulserv-app npm run build

podman restart pijulserv-app