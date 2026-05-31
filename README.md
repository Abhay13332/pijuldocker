# PijulServ 

An open-source, full-stack, multi-tenant collaboration forge for the Pijul version control system. This platform provides repository hosting, granular role permissions (Owner, Maintainer, Developer, Visitor), and an upcoming asynchronous GitHub-to-Pijul patch translation engine.

## Architecture and Tech Stack

This project is organized as a monorepo containing all components required to run the forge:
* `/backend`: Multi-tenant hosting and permission engine.
* `/frontend`: Interactive UI for dashboard, repository management, and collaboration workflows.
* `/scripts`: Automation utilities and service lifecycles.

---

## Local Deployment (Docker Compose)

The entire stack is containerized and can be launched locally using Docker Compose.

### Prerequisites
* Docker
* Docker Compose v2+

### Deployment Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Abhay13332/pijuldocker
   cd pijuldocker
   ```

2. Spin up the environment:
   ```bash
   docker compose up --build
   ```

---
## Current Caveats and Roadmap

Note for Reviewers and Contributors: The platform is currently hosted in a test environment (B1). The local containerized orchestration functions successfully, but several architectural configuration limitations are being resolved in the upcoming development sprint:

* Build-Time Arguments: The Dockerfile currently lacks explicit ARG instructions required to inject environment variables securely during the container build stage.
* Missing Configuration Templates: An example environment file (such as .env.example) is not yet included for the backend service, requiring manual variable declarations to prevent runtime dependency failures.
* Network Routing Hooks: Fine-tuning ingress proxies to prepare for inbound foreign webhooks (GitHub-to-Pijul sync engine).

These development bottlenecks are actively being resolved. Contributions, issue tickets, and architectural feedback are welcome.

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the LICENSE file for details. This license ensures that the forge and its downstream variants remain open and accessible public infrastructure permanently.
