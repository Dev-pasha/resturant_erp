# Restaurant ERP — Project Docs (Phase 1)

These files are the specification for building the Restaurant ERP with Claude Code.

## Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Standing instructions Claude Code reads every session: stack, rules, workflow |
| `docs/PRD.md` | Every Phase 1 feature, business rule and acceptance check (incl. branding & customization §14) |
| `docs/ARCHITECTURE.md` | System design: apps, multi-tenancy, offline sync, printing, theming, deployment |
| `docs/DATABASE.md` | Full data model |
| `docs/API.md` | All endpoints and realtime events |
| `docs/BUILD_PLAN.md` | 12 milestones in build order, each with a ready-to-paste Claude Code prompt |
| `docs/PROGRESS.md` | Progress log Claude Code keeps updated |

## How to start

1. Install Node.js 20+, pnpm, Docker Desktop, Git, and Claude Code.
2. Create an empty folder (e.g. `restaurant-erp`), copy these files into it so `CLAUDE.md` is at the root and the specs are in `docs/`.
3. `git init` and make a first commit.
4. Open the folder in a terminal and start Claude Code.
5. Paste:
   > Read CLAUDE.md and docs/PROGRESS.md. We are on Milestone 0. Read the relevant sections of docs/PRD.md, ARCHITECTURE.md, DATABASE.md and API.md, then propose a plan before coding.
6. Review the plan, approve, and continue milestone by milestone using the prompts in `docs/BUILD_PLAN.md`.

## Before you go live, decide

- Your domain name (replace `ourdomain.pk` across the docs)
- SMS / WhatsApp OTP provider
- Hosting (VPS provider) and object storage (Cloudflare R2 or S3)
- Whether clients need tax authority (PRA/FBR) POS integration, and get the official integration spec

## Demo logins (after seeding)
Documented here by Claude Code once Milestone 0–1 seed exists.
