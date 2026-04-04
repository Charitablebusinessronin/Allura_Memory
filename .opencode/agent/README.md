# OpenCode Agent Menu

**Quick Reference Guide** → All custom roninmemory agents available through OpenCode

---

## 🎯 Quick Start

| When you need... | Call... | Invocation |
|------------------|---------|------------|
| **Start a task / orchestrate** | `memory-orchestrator` | `@memory-orchestrator` |
| **Write code / implement** | `memory-architect` | `@memory-architect` |
| **Find standards / patterns** | `memory-scout` ⭐ | `@memory-scout` |
| **External library docs** | `memory-archivist` | `@memory-archivist` |
| **Plan complex feature** | `memory-curator` | `@memory-curator` |
| **Write tests** | `memory-tester` | `@memory-tester` |
| **Code review** | `memory-guardian` | `@memory-guardian` |
| **Write documentation** | `memory-chronicler` | `@memory-chronicler` |

⭐ = Approval gate exempt (can call anytime)

---

## 🏛️ Primary Agents

### memory-orchestrator
**Role**: Universal AI agent for code, docs, tests, and workflow coordination

**Best For**:
- Starting new tasks
- Coordinating multi-step workflows
- Delegating to subagents
- Managing context across agents

**Workflow**: Plan → Approve → Execute → Validate → Summarize

**Use When**: You need a primary orchestrator to coordinate complex work across multiple agents.

---

### memory-architect
**Role**: Senior software engineer for story execution and code implementation

**Best For**:
- Complex coding tasks
- Architecture decisions
- Implementation planning
- Technical design

**Workflow**: Discover → Propose → Approve → Init Session → Plan → Execute → Validate → Handoff

**OpenCode agent**: `memory-architect`

---

## 🎭 Core Subagents

### memory-scout ⭐
**Role**: Discovers internal context files BEFORE executing

**Capabilities**:
- Context discovery
- Pattern finding
- Standard lookup
- File location

**Best For**: Finding coding standards, discovering patterns, locating relevant context

**Exemption**: **Approval gate exempt** - can be called without approval

**Note**: Always call this first before any implementation work

---

### memory-archivist
**Role**: Fetches current documentation for external packages

**Capabilities**:
- External library docs
- API documentation
- Integration patterns
- Current best practices

**Best For**: New library integration, API usage patterns, external package setup

**Important**: **MANDATORY** for any external library work - training data is outdated!

---

### memory-curator
**Role**: Curates and organizes tasks with dependency tracking

**Capabilities**:
- Task breakdown
- Dependency tracking
- JSON task creation
- Parallel task identification

**Best For**: Complex feature breakdown, task planning, dependency mapping

**Output**: Creates `.tmp/tasks/{feature}/task.json` + `subtask_NN.json` files

---

### memory-chronicler
**Role**: Generates comprehensive documentation

**Capabilities**:
- Documentation generation
- Technical writing
- Knowledge capture
- ADR creation

**Best For**: Writing docs, creating ADRs, technical documentation

**OpenCode agent**: `memory-chronicler`

---

### memory-retriever
**Role**: Generic context search and retrieval specialist

**Capabilities**:
- Context retrieval
- Standards lookup
- Pattern matching
- File search

**Best For**: Finding specific files, standards lookup, pattern discovery

---

## 💻 Code Subagents

### memory-builder
**Role**: Builds and implements code with memory-aware patterns

**Capabilities**:
- Code implementation
- Subtask execution
- Pattern application
- Self-review

**Best For**: Writing code, implementing features, following task JSONs

**OpenCode agent**: `memory-builder`

---

### memory-tester
**Role**: Tests the roninmemory system

**Capabilities**:
- Test authoring
- TDD implementation
- Coverage analysis
- Positive/negative testing

**Best For**: Writing tests, test coverage, TDD workflows

**Pattern**: Arrange-Act-Assert + Positive/Negative cases

**OpenCode agent**: `memory-tester`

---

### memory-guardian
**Role**: Guards roninmemory code quality

**Capabilities**:
- Code review
- Security audit
- Pattern validation
- Quality checks

**Best For**: Code reviews, security audits, pattern validation

---

### memory-validator
**Role**: Validates builds and types

**Capabilities**:
- Build validation
- Type checking
- Lint compliance
- Integrity checks

**Best For**: Build validation, type checking, pre-commit checks

---

## 🏗️ System Builder Subagents

### memory-organizer
**Role**: Organizes roninmemory context and knowledge

**Capabilities**:
- Context organization
- Knowledge structuring
- Domain modeling
- Standard creation

**Best For**: Organizing context, structuring knowledge

---

### memory-generator
**Role**: Generates XML-optimized agent files

**Capabilities**:
- Agent generation
- XML optimization
- Pattern application

**Best For**: Creating agents, agent optimization

---

### memory-commander
**Role**: Creates custom slash commands

**Capabilities**:
- Command creation
- Slash command design
- Routing logic

**Best For**: Creating slash commands, command routing

---

### memory-workflow
**Role**: Designs complete workflow definitions

**Capabilities**:
- Workflow design
- Process definition
- Dependency mapping

**Best For**: Designing workflows, process definition

---

### memory-domain
**Role**: Analyzes user domains

**Capabilities**:
- Domain analysis
- Concept identification
- Agent recommendation

**Best For**: Domain analysis, concept modeling

---

## 🎨 Development Subagents

### memory-interface
**Role**: Designs the interface layer

**Capabilities**:
- UI design
- Component creation
- Visualization
- Interaction patterns

**Best For**: Frontend development, UI components, visualizations

**Stack**: React, Next.js, Tailwind

---

### memory-infrastructure
**Role**: Builds infrastructure

**Capabilities**:
- Infrastructure setup
- Database management
- Docker configuration
- Deployment automation

**Best For**: Infrastructure setup, database config, Docker/deployment

---

## 📚 Content & Data Agents

### memory-scribe
**Role**: Technical documentation specialist

**Best For**: Technical writing, documentation, content curation

---

### memory-copyist
**Role**: Copywriting specialist

**Best For**: Marketing copy, user-facing content, creative writing

---

### memory-analyst
**Role**: Data analysis specialist

**Best For**: Data analysis, insights, reporting, analytics

---

## 🔧 Utility Agents

### memory-visualizer
**Role**: Image editing and analysis specialist

**Best For**: Image editing, visual analysis, image processing

---

## 📋 Common Workflows

### Standard Task Workflow
```
1. Discover → memory-scout (find context)
2. Approve → memory-orchestrator (present plan)
3. Execute → [appropriate agent] (implement)
4. Validate → memory-tester (run tests)
5. Summarize → memory-orchestrator (report)
```

### Complex Feature Workflow
```
1. Break Down → memory-curator (create tasks)
2. Execute → memory-builder (parallel batches)
3. Validate → memory-tester (test all)
4. Review → memory-guardian (code review)
```

### External Library Integration
```
1. Discover → memory-scout (find project standards)
2. Research → memory-archivist (fetch current docs)
3. Implement → memory-builder (with current docs)
4. Validate → memory-tester (test integration)
```

---

## 🚨 Critical Rules

1. **Always call memory-scout first** for context discovery
2. **Always call memory-archivist** for external library work
3. **All agents need approval gate** (except memory-scout)
4. **Load context before execution** - every time
5. **Never skip self-review** for memory-builder
6. **Always positive + negative tests** for memory-tester

---

## 📁 File Locations

- **Primary Agents**: `.opencode/agent/core/`
- **Core Subagents**: `.opencode/agent/subagents/core/`
- **Code Subagents**: `.opencode/agent/subagents/code/`
- **System Builders**: `.opencode/agent/subagents/system-builder/`
- **Development**: `.opencode/agent/subagents/development/`

---

## 🔄 Module Overview

**Installed modules**:
- `core` - Core utilities
- `bmm` - Business Analysis & Planning
- `bmb` - Builder (workflows & agents)
- `tea` - Test Architecture
- `wds` - Workflow Design System

**Workflows**: Available via skills in `.opencode/skills/`

**Source of truth**: `.opencode/agent/` directory

---

*Last Updated: 2026-04-03*
*Version: 1.0.0*
