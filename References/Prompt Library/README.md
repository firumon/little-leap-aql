# AQL Prompt Library

## Purpose
This directory contains machine-optimized, procedural initialization prompts and execution instructions designed **exclusively for AI Agents**.

## Key Distinction
- **`Documents/` (Humans & AI Agents)**: Canonical architecture specifications, data schemas, domain workflows, and system rules. Both humans and AI agents read these files to understand how the system works.
- **`References/Prompt Library/Initialization/` (AI Agents Only)**: Machine-optimized, task-specific procedural prompts and checklists. These instruct the AI agent on how to completely execute a specific task or workflow.

## Startup & Routing
Prompt loading is strictly governed by `AGENTS.md` and `References/Prompt Library/MAP.md`. AI agents load only the matching initialization prompt based on query classification.
