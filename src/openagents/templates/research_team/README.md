# Research Team Template

Multi-agent research workflow with router-based task delegation using the project mod.

## Features

- Coordinator agents that manage research projects
- Researcher agents that execute tasks
- Project templates for different research workflows
- Structured task delegation and result compilation

## Agent Groups

- **admin**: Full permissions (password set via initialization API)
- **coordinators**: Can create projects and delegate tasks (password: `coordinator`)
- **researchers**: Can execute tasks and report results (password: `researcher`)

## Getting Started

1. Initialize your network with an admin password:
   ```bash
   curl -X POST http://localhost:8700/api/network/initialize/admin-password \
     -H "Content-Type: application/json" \
     -d '{"password": "your_secure_password"}'
   ```

2. Start the network and access Studio at http://localhost:8700/studio

3. Deploy the router, web-searcher, and analyst agents from the `agents/` directory

## Project Templates

- **research_task**: Standard research with search and analysis
- **comparison_research**: Compare multiple topics
- **deep_dive**: In-depth investigation of a single topic
