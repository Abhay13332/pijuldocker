#! /usr/bin/bash
podman cp backend/server.js pijulserv-app:/app/backend/server.js                                             
podman cp backend/ssh-server.js  pijulserv-app:/app/backend/ssh-server.js                                    
podman cp backend/repoStore.js pijulserv-app:/app/backend/repoStore.js                                       
podman cp backend/discussionStore.js pijulserv-app:/app/backend/discussionStore.js                           
# podman cp backend/users.js pijulserv-app:/app/backend/users.js                                               

podman restart pijulserv-app