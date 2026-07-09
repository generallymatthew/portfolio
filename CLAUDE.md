# Claude Code Configuration

## Permissions

These tools are pre-authorized for this project without requiring permission prompts:
- **File Operations**: Read, Write, Edit (safe for local project files)
- **Bash**: Shell commands and git operations within the project
- **Preview Tools**: Dev server, screenshots, network inspection

These tools still require confirmation for safety:
- **Git Push**: Always ask before pushing to remote
- **Git Force Operations**: Always ask before --force, --hard, destructive operations
- **API Calls**: Ask before calling external APIs (safety check)

## Conventions

- Commit at sensible checkpoints proactively (don't ask before committing)
- Pushing still requires explicit user confirmation
- Use absolute paths for file operations
- Keep node_modules out of git commits

## Project Context

This is the AI Scholarship Assistant - a local-first web app for scholarship discovery and applications.

- **Frontend**: `/public/index.html` - React-style vanilla JS chat interface
- **Backend**: `/server.js` - Express server with Claude API integration
- **Data**: `/data/scholarships.json` - Scholarship database
- **Requires**: `ANTHROPIC_API_KEY` environment variable for Claude API

Phase 1 (chat UI) complete. Phase 2 (form integration + real crawling) in progress.
