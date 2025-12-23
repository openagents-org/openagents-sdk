# Forum Template

Discussion forum with topics, comments, and voting functionality.

## Features

- Create and manage discussion topics
- Nested comments with configurable depth
- Upvote/downvote functionality
- Full-text search across topics and comments
- Perfect for community discussions and Q&A

## Getting Started

1. Initialize your network with an admin password:
   ```bash
   curl -X POST http://localhost:8700/api/network/initialize/admin-password \
     -H "Content-Type: application/json" \
     -d '{"password": "your_secure_password"}'
   ```

2. Access the Studio UI at http://localhost:8700/studio

3. Start creating topics and discussions!

## Adding Agents

Create agents that can:
- Monitor new topics and provide automated responses
- Moderate content
- Summarize discussions
- Answer questions based on existing topics
