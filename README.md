# saptha-hacks-dashboard — INNOVEDGE Assessor Platform

Official AI-Powered Project Evaluation & Team Qualification System for INNOVEDGE Hackathons.

## Features

- **Gemini 3.1 Flash Lite Integration**: Fast, structured multi-modal AI evaluation of project documentation, code repositories, and web prototypes.
- **Problem Statement Management**: Create, edit, and organize challenges with category tracking and mandatory team selection.
- **Team Qualification & Shortlisting**: Instant 1-click ticking to qualify/disqualify teams for next rounds with live search and filtering.
- **1-Page Printable PDF Scorecards**: Official certified scorecard featuring the INNOVEDGE crest as a transparent background watermark, score breakdowns, dynamic actionable improvement recommendations, and digital verification.
- **Plagiarism & Originality Detection**: Jaccard similarity scanner for project text/PDF content and duplicate GitHub repository tracking with 1-click penalty deductions.
- **Event-Wide Analytics**: Real-time evaluation queue, score distributions, and leaderboards.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation
```bash
# Clone the repository
git clone https://github.com/ppuni8298-cloud/saptha-hacks-dashboard.git
cd saptha-hacks-dashboard

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your Gemini API Key and Supabase credentials

# Start development server
pnpm dev
```

### Running Tests
```bash
pnpm test
```

## Built With
- [TanStack Start](https://tanstack.com/start) & TanStack Router
- [React](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) & Radix UI
- [Google Gemini API](https://ai.google.dev/) (`gemini-3.1-flash-lite`)
- [Supabase](https://supabase.com/)
