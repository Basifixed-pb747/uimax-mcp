# ui-audit-mcp

**AI-powered UI review tool for Claude Code.** Captures screenshots, runs accessibility audits, measures performance, and analyzes frontend code — giving Claude everything it needs to act as a world-class frontend expert and review your UI.

<p align="center">
  <img src="https://img.shields.io/npm/v/ui-audit-mcp" alt="npm version" />
  <img src="https://img.shields.io/npm/l/ui-audit-mcp" alt="license" />
  <img src="https://img.shields.io/badge/MCP-compatible-blueviolet" alt="MCP compatible" />
</p>

## The Problem

You're building a frontend. You want expert-level feedback on your UI — visual design, accessibility, performance, code quality. Normally you'd need to:

1. Take screenshots manually
2. Run Lighthouse / axe separately
3. Review your own code with fresh eyes
4. Compile all findings into a coherent review
5. Then figure out the fixes

**That's 5 steps too many.**

## The Solution

Install this MCP server, point it at your running app, and tell Claude:

> "Review the UI at localhost:3000"

Claude will automatically:
1. 📸 **Capture screenshots** of your actual rendered UI
2. ♿ **Run accessibility audits** (WCAG 2.1 via axe-core)
3. ⚡ **Measure performance** (Core Web Vitals)
4. 🔍 **Analyze your source code** for anti-patterns
5. 📋 **Generate an expert review** with specific, actionable fixes
6. 🔧 **Implement the fixes** right there in your codebase

**One command. Full expert review. Automatic fixes.**

## Quick Start

### Install as MCP Server (for Claude Code)

```bash
# Add to Claude Code
claude mcp add ui-audit -- npx -y ui-audit-mcp
```

That's it. Now in any Claude Code conversation:

```
You: Review the UI at http://localhost:3000, source code is in ./src

Claude: *captures screenshot, runs audits, analyzes code*
       *generates detailed expert review*
       *implements fixes automatically*
```

### Install Globally

```bash
npm install -g ui-audit-mcp
```

## Tools

The MCP server exposes 6 tools that Claude uses automatically:

### `full_review` ⭐ Primary Tool
Runs **everything** — screenshot + accessibility + performance + code analysis. This is the tool Claude will call when you ask for a UI review.

```
Input: URL + code directory
Output: Screenshot (visible to Claude) + comprehensive audit data
```

### `screenshot`
Captures a high-resolution PNG screenshot of any URL. Claude can see the image directly and analyze visual design, layout, spacing, typography, and color usage.

```
Input: URL, viewport size, full-page option
Output: PNG image + metadata
```

### `responsive_screenshots`
Captures screenshots at **mobile (375px)**, **tablet (768px)**, and **desktop (1440px)** viewports. Perfect for reviewing responsive design.

### `accessibility_audit`
Injects [axe-core](https://github.com/dequelabs/axe-core) into the page and runs a WCAG 2.1 Level A & AA audit. Returns violations grouped by severity with fix instructions.

### `performance_audit`
Measures Core Web Vitals using the browser's Performance API:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)
- DOM node count, resource count, JS heap size

### `analyze_code`
Scans frontend source files for 15+ categories of issues:
- Missing alt attributes, form labels, ARIA
- `!important` abuse, hardcoded colors, z-index chaos
- Console.logs, TODO/FIXMEs, `any` types
- Large files, deep nesting, inline styles
- Missing lazy loading, full library imports

## Prompts

The server also provides expert review prompts that guide Claude's analysis:

| Prompt | Use Case |
|--------|----------|
| `ui-review` | Comprehensive review methodology (design + UX + a11y + perf + code) |
| `responsive-review` | Responsive design review across viewports |
| `quick-design-review` | Fast visual/UX feedback from a screenshot only |

## Example Workflows

### Full Review
```
You: Review the UI at http://localhost:3000
     Source code is in /Users/me/project/src

Claude: [Calls full_review tool]
        [Sees screenshot, reads audit data]
        [Generates comprehensive review with 20+ findings]
        [Starts implementing fixes]
```

### Responsive Check
```
You: Check if my site is responsive - http://localhost:3000

Claude: [Calls responsive_screenshots tool]
        [Sees mobile, tablet, desktop views]
        [Identifies layout issues at each breakpoint]
```

### Quick Design Feedback
```
You: Take a screenshot of localhost:3000 and tell me
     what a senior designer would change

Claude: [Calls screenshot tool]
        [Provides focused design feedback]
```

### Accessibility Only
```
You: Run an accessibility audit on http://localhost:3000

Claude: [Calls accessibility_audit tool]
        [Reports WCAG violations with fix instructions]
```

## What Claude Reviews

When using the `ui-review` prompt methodology, Claude evaluates:

### Visual Design
- Layout and grid alignment
- Typography hierarchy and readability
- Color consistency and contrast
- Visual rhythm and whitespace
- Border radius, shadows, icon consistency

### User Experience
- Navigation clarity and flow
- Interaction states (hover, active, focus)
- Loading, error, and empty states
- Edge cases (overflow, missing data)

### Accessibility
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management

### Performance
- Core Web Vitals scoring
- Render-blocking resources
- Image optimization opportunities
- Bundle size concerns

### Code Quality
- Component architecture
- CSS organization
- State management patterns
- Error boundary coverage
- TypeScript type safety

### Creative Improvements
- Modern UI patterns from Linear, Vercel, Raycast
- Micro-interaction opportunities
- Animation suggestions
- Quick wins for perceived quality

## Code Analysis Rules

The `analyze_code` tool checks for **15+ rules** across categories:

| Rule | Severity | Category |
|------|----------|----------|
| `img-no-alt` | High | Accessibility |
| `click-no-keyboard` | High | Accessibility |
| `no-form-label` | High | Accessibility |
| `no-lang-attr` | Medium | Accessibility |
| `console-log` | Low | Code Quality |
| `todo-fixme` | Low | Code Quality |
| `inline-style` | Medium | Code Quality |
| `any-type` | Medium | Code Quality |
| `magic-number` | Low | Code Quality |
| `important-css` | Medium | Design |
| `hardcoded-color` | Low | Design |
| `z-index-high` | Medium | Design |
| `no-lazy-image` | Medium | Performance |
| `large-bundle-import` | Medium | Performance |
| `large-file` | Medium/High | Code Quality |
| `deep-nesting` | Medium/High | Code Quality |

## Supported Frameworks

Auto-detected from `package.json`:
- React / Next.js
- Vue / Nuxt
- Svelte / SvelteKit
- Angular
- Plain HTML/CSS/JS

## Requirements

- **Node.js** >= 18.0.0
- **Chrome/Chromium** (Puppeteer downloads its own copy)
- **Claude Code** (for MCP integration)

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   Claude Code                        │
│                                                      │
│  User: "Review my UI"                                │
│           │                                          │
│           ▼                                          │
│  ┌─────────────────┐                                 │
│  │  ui-audit MCP   │                                 │
│  │                  │                                 │
│  │  📸 Screenshot ──┼──► Puppeteer ──► PNG Image     │
│  │  ♿ Accessibility┼──► axe-core ──► Violations     │
│  │  ⚡ Performance ─┼──► Perf API ──► Web Vitals    │
│  │  🔍 Code Analysis┼──► File Scan ─► Findings      │
│  └────────┬─────────┘                                │
│           │                                          │
│           ▼                                          │
│  Claude sees screenshot + all data                   │
│  Claude applies expert review methodology            │
│  Claude generates findings + implements fixes        │
└─────────────────────────────────────────────────────┘
```

## Development

```bash
# Clone
git clone https://github.com/prembobby39-gif/ui-audit-mcp.git
cd ui-audit-mcp

# Install
npm install

# Build
npm run build

# Test locally with Claude Code
claude mcp add ui-audit-dev -- node /path/to/ui-audit-mcp/dist/index.js
```

## Contributing

Contributions welcome! Some ideas:

- [ ] Additional code analysis rules
- [ ] CSS specificity analyzer
- [ ] Design token extraction
- [ ] Lighthouse integration
- [ ] Visual regression comparison
- [ ] Framework-specific checks (React hooks, Vue composition API)
- [ ] Custom rule configuration
- [ ] HTML report export

## License

MIT
