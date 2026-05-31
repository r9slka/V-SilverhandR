# V Silverhand — Personal AI Companion

*Read this in [French](README.fr.md)*

A personal mobile web app that works like a private AI assistant, accessed from your phone like a messaging app. V Silverhand remembers every conversation, knows the user through personal notes, analyzes files, and sends a briefing every morning. Fully private, single-user, hosted for free.

---

## What it's for

Most chatbots forget everything the moment you close the tab. V Silverhand keeps a persistent memory, builds context about the user over time, and stays accessible straight from the phone's home screen.

---

## Features

- **Real-time chat** with a defined AI personality
- **Persistent memory** across all conversations
- **Smart memory** — older messages are summarized and compressed automatically for long-term recall
- **Memory manager panel** to view, edit, and delete memories
- **Personal notes** always injected into the AI's context
- **File uploads** — analysis of PDFs and images
- **Daily automated morning briefing**
- **PWA** — installable on the home screen, fullscreen, no browser bar
- **Continuous deployment** — every code change goes live automatically

---

## Tech stack

| Component | Technology | Cost |
|---|---|---|
| Frontend | HTML / CSS / JavaScript | Free |
| AI | Groq API (LLaMA 3) | Free |
| Database / Memory | Supabase | Free |
| Hosting | Vercel | Free |
| Scheduled tasks | Vercel Cron Jobs | Free |
| Versioning | GitHub | Free |

---

## Architecture

The frontend is served by Vercel. Sensitive calls (AI, database) go through serverless functions so API keys are never exposed in the browser. Messages and personal notes are stored in Supabase. A Vercel Cron job triggers the daily briefing each morning.

```
Phone (PWA)
      │
      ▼
Frontend (HTML/CSS/JS) ──► Vercel (hosting + serverless functions)
      │
      ├──► /api/chat.js      ──► Groq API (response generation)
      │         │
      │         ▼
      │    Supabase (messages + personal notes)
      │
      └──► /api/briefing.js  ◄── Vercel Cron (daily at 8 AM)
```

---

## How it was built

Developed in 4 phases, each validated on the phone before moving to the next:

1. **Phase 1** — Mobile chat UI deployed online (no AI yet)
2. **Phase 2** — AI connected for real-time replies
3. **Phase 3** — Persistent memory via Supabase
4. **Phase 4** — Memory management, file uploads, smart memory, daily briefing, PWA

Planning was done in Claude (chat); code execution via Claude Code in VS Code.

---

## Skills demonstrated

**Project architecture** — Breaking an idea into concrete, shippable phases with a logical build order.

**API integration** — Connecting multiple third-party services (AI, database, hosting). Understanding client-side vs server-side calls and why API keys must stay secret.

**Database design** — Designing tables, managing relationships, building a persistent memory system with context compression.

**Deployment and DevOps** — Continuous deployment pipeline (GitHub → Vercel), environment variable management, automated cron jobs.

**Debugging** — Reading error messages (API quotas, invalid keys, foreign key violations), identifying root causes, and deciding when to switch approach — e.g. dropping Gemini for Groq after persistent quota issues.

**AI-assisted development** — Structuring precise instructions for a coding agent, knowing when to plan and when to execute, keeping control of the architecture without writing every line manually.

**Security awareness** — Keeping API keys out of the frontend, isolating user data, choosing privacy-respecting defaults.

---

## Notable choices

- **Groq over Gemini** — Gemini hit blocking quota limits even under light use. Groq proved immediately stable and free.
- **No login** — Magic-link authentication added unnecessary friction for a personal-use app. A hardcoded single-user setup keeps it simple.
- **Compressed memory** — Rather than loading a fixed number of recent messages, older conversations are summarized to enable long-term recall without overflowing the model's context window.

---

## Running cost

**$0/month** — all services stay within their free tiers.
