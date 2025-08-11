# 🚀 AI Dev Starter

> Task Master AI + Claude Code + Cursor Integrated Development Template

## 📋 Overview

AI Dev Starter is a template that lets you instantly start a modern development environment with AI assistants.
Start AI-powered development immediately without any configuration.

### ✨ Key Features

- **🤖 Task Master AI**: PRD-based automatic task generation and management (Claude Code only)
- **🔧 Dual IDE Support**: Use the same development rules in both Claude Code and Cursor
- **📚 24 Automation Rules**: Automated development workflows
- **🔌 MCP Server**: Use Task Master as an MCP server in Claude Code
- **🎯 Zero Config**: No API keys or environment variables needed

## 🚀 Quick Start

### 1. Copy Project

```bash
# Copy this template to a new project
cp -r ai-dev-starter my-new-project
cd my-new-project
```

### 2. Use Task Master in Claude Code (Optional)

When using Claude Code, Task Master AI is automatically activated.
No API key configuration needed - Claude provides them automatically.

```bash
# Generate tasks after writing PRD
# Run inside Claude Code
npx task-master parse-prd .taskmaster/docs/prd.txt
```

### 3. Start Development

```bash
# Claude Code (with Task Master support)
claude

# Or Cursor (development rules only)
cursor .
```

## 📁 Project Structure

```
ai-dev-starter/
├── .taskmaster/          # Task Master configuration (Claude Code only)
│   ├── config.json      # AI model settings
│   ├── docs/           # PRD documents
│   └── tasks/          # Task files
├── .claude/             # Claude Code settings
├── .cursor/             # Cursor IDE settings
├── .project-rules/      # Automation rules (24 rules)
├── .cursorrules        # Cursor integration rules
├── .mcp.json          # MCP server configuration (Claude Code)
└── package.json        # Project metadata
```

## 🔧 Main Commands

### Task Master (Claude Code only)
```bash
task-master next                              # Check next task
task-master show <id>                        # View task details
task-master set-status --id=<id> --status=done  # Mark as complete
task-master add-task --prompt="description"  # Add new task
```

### IDE Automation Commands
Available in both IDEs:
- `/commit` - Generate smart commit messages
- `/check` - Code quality inspection
- `/pr-review` - PR review
- `/create-docs` - Documentation generation
- `/implement-task` - Systematic task implementation
- `/analyze-jira-issue` - Jira issue analysis

## 📝 Task Master Usage Guide (Claude Code Only)

### PRD-based Task Generation

1. Use PRD template:
```bash
cp .taskmaster/docs/prd_template.md .taskmaster/docs/prd.txt
```

2. Generate tasks after editing PRD:
```bash
# Run inside Claude Code
npx task-master parse-prd .taskmaster/docs/prd.txt
```

### Daily Workflow

```bash
# 1. Check next task
npx task-master next

# 2. Start working
npx task-master set-status --id=1 --status=in-progress

# 3. Code (in Claude Code)
# Task Master provides context

# 4. Complete task
npx task-master set-status --id=1 --status=done
```

## 💡 Tips

### IDE-specific Features

#### Claude Code
- Full Task Master AI support (no API keys needed)
- Task management through MCP server
- Automatic application of `CLAUDE.md` and `.claude/` settings

#### Cursor
- All development rules applied through `.cursorrules`
- 24 automation rules available
- Task Master not supported

### Project Structure Flexibility

This template supports various project structures:
- Single project (src/ directory)
- Monorepo (packages/ directory)
- Root-level source code
- Custom structure

## 🔧 Automation Rules List

Includes 24 development automation rules:
- `commit` - Smart commit messages
- `check` - Code quality inspection
- `pr-review` - Multi-perspective PR review
- `create-docs` - Automatic documentation generation
- Plus 20 more rules...

## 📄 License

MIT License

---

**Made with ❤️ for AI-powered development**