# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is at its initial state — it currently contains only `README.md` and `.gitignore`. There is **no source code, build system, test setup, or chosen tech stack yet**. The sections below reflect what is known; update this file as the codebase takes shape.

## What this project is

"Kiipeily Treeni Appi" (Finnish: *Climbing Training App*) — an application for planning and tracking climbing training (kiipeilytreenien suunnitteluun ja seurantaan).

The README and project description are in Finnish; expect Finnish-language naming and user-facing text.

## Tech stack

Not yet chosen. The `.gitignore` is written to accommodate multiple ecosystems (Node.js: `node_modules/`, `dist/`; PHP: `vendor/`; Python: `__pycache__/`, `.venv/`) but does not commit the project to any of them. When introducing a stack, prune `.gitignore` to the one(s) actually used and record the build/lint/test commands here.

## Conventions to preserve

- Secrets stay out of version control: `.env*` and `*.key` are gitignored. Keep credentials in environment files, never hardcoded.
