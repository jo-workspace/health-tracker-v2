<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Collaboration & Workflow Guidelines

## 1. Idea Alignment & Constructive Feedback
- **Summarize First**: Whenever the user proposes an idea or requirement, provide a concise summary first to confirm accurate understanding.
- **Balanced & Constructive Suggestions**: Offer objective feedback and constructive suggestions (highlighting pros, cons, and trade-offs) without blindly agreeing or questioning merely for the sake of skepticism.
- **Tiered Planning & Execution**:
  - **Major Changes** (New architectural modules, complex cross-system features): Create a formal implementation plan artifact before execution.
  - **Medium Changes** (Moderate logic refactoring, multi-file updates): Outline the proposed approach conversationally in chat to confirm before executing.
  - **Minor Changes** (Direct bug fixes, styling tweaks, single-point edits): Implement and verify directly.

## 2. Git Commit & Deployment Policy
- **Always Commit & Push**: After making code changes and verifying them, always stage, commit with a descriptive message, and push to GitHub (`origin/main`).
- **Rationale**: Vercel automatically deploys updates upon push to GitHub.

