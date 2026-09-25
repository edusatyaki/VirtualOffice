# Virtual Office

A product company where every employee is an AI agent. You bring an idea, and the office
staffs itself, plans a token budget, waits for your approval, then builds, tests and ships it.
Every hand-off between agents is visible on a live office floor.

> **Status: v0.2, simulation.** The agents are simulated. The engine emits the same state the
> real agent backend will emit, so the floor, panels and reports stay the same when real
> Claude agents are plugged in.

**Live demo:** https://edusatyaki.github.io/VirtualOffice/

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5190 and click **Brief the Product Manager**. Use **Pause** and
**Step ›** to follow the office one step at a time, or tick **Auto-approve gates** and pick 4×
to watch a whole project ship.

Every push to `main` rebuilds and redeploys the live demo through
`.github/workflows/deploy.yml`.

## How a project flows

```
You ──brief──▶ Product Manager ──requisition──▶ HR ──hires──▶ Solution Architect
                                                                   │
                     workflow, architecture, team plan (who and how many)
                                                                   ▼
            HR ◀──one requisition per seat── Architect      HR hires every seat;
                                                            new hires walk in from Reception
                                                                   │
   Product Manager ◀──estimate inputs── Architect: token budget per role (+20% rework buffer)
                                                                   │
                          ✋ Gate 1: you approve the team and the token budget
                                                                   │
   Design & sprint plan ─▶ Scrum Master assigns stories to named developers ─▶ build
   dev ─▶ Tech Lead (review) ─▶ QA ─▶ Performance QA ─▶ DevOps (deploy)
   (bugs and slow endpoints go back to the same developer)
                                                                   │
                          ✋ Gate 2: sprint demo / UAT      ✋ Gate 3: go live
```

The office starts with three people: **you**, **Rohan (Product Manager)** and **Neha (HR)**.
Everyone else is hired for the project, based on the Architect's team plan. The plan
changes with the brief: “mobile” adds a Mobile Dev, and “MVP” or “simple” means full-stack
devs and a smaller scope.

## The office

| Room | Department | Who sits there |
|---|---|---|
| Reception | Onboarding | New hires arrive here, then walk to their desks |
| Product Office | Product | Product Manager |
| Architecture Room | Architecture | Solution Architect |
| Design Studio | Design | UI/UX Designer |
| HR & Staffing | People | HR |
| Engineering Floor | Engineering | Tech Lead, Frontend, Backend, Full-stack, Mobile devs |
| Scrum War Room | Delivery | Scrum Master |
| Boardroom | Client | You. Every approval lands here |
| QA Lab | Quality | QA Testers |
| Performance Lab | Performance | Performance QA: load, spike and soak tests for 1 lakh / 10 lakh users |
| Server Room | DevOps | DevOps Engineer |

## Token budget

Every agent burns tokens while it works (`TOKENS_PER_TICK` in `src/domain/office.ts`).
Once the team is hired, the PM estimates the budget: tokens already spent, plus the expected
cost of every remaining document and every story stage, per role, plus a 20% buffer for
rework. It's priced at a blended `USD_PER_M_TOKENS` rate you can change. After you approve,
the Overview shows spend against the budget, and the log warns at 80% and 100%.

## What's on screen

- **Full screen.** The **⛶ Full screen** button (or the **F** key) puts the office floor on the
  whole screen, with playback controls on top and approval cards popping up in the corner.
  **Esc** exits.
- **Floor.** Each room shows its headcount and open task count. Tasks fly **from one agent's
  desk to another's**, labelled with the task number and “Sender → Receiver”.
- **Overview.** Phase, token budget meter, headcount per department, the Architect's team
  plan with hired / needed, and the delivery pipeline.
- **Handoffs.** Numbered, in order: who passed which task to whom, and between which rooms.
- **Tasks.** Every task with its owner, who handed it over, and its trail of rooms.
- **Activity.** A live feed of everything that happened.
- **Reports.** The daily report, and one on demand: progress, tokens against budget,
  quality, blockers. Reports use only facts from the task records.

## Look and feel

The visual style follows [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin)'s
design system: cream panels with three-layer pixel borders, ink outlines, Press Start 2P /
Pixelify Sans / VT323, wood-floored rooms, and hand-drawn pixel people who sit at desks and
walk between rooms. The character drawing code is ported from Munder Difflin (MIT) with a
new outfit and hairstyle for each of our staff. See `THIRD_PARTY_NOTICES.md`. Munder
Difflin's LimeZu tileset is licensed separately and is not used.

## Code map

```
src/domain/types.ts     Agent, Task, Flight, Approval, StatusReport, OfficeState
src/domain/office.ts    Rooms, roles, founders, talent pool, team-plan logic, token rates, phases + gates
src/sim/engine.ts       Simulation engine: phase state machine, assignment, work, rework, reports
src/art/pixelPeople.ts        Pixel portraits + walking sprites (ported from Munder Difflin)
src/components/Floor.tsx      SVG office floor: rooms, desks, pixel staff, flying envelopes
src/components/SidePanel.tsx  Brief form, budget approval, overview, handoffs, tasks, activity, reports
src/components/Roster.tsx     Staff strip
```

## Roadmap

1. **v0.1.** Office floor, full SDLC pipeline, gates, daily reports, all simulated.
2. **v0.2 (this).** Hiring-first flow (PM → Architect → HR), token budget and approval,
   agent-to-agent hand-offs, step-by-step mode.
3. **Backend.** Move the engine to a Node service with Postgres (projects, phases, tasks,
   approvals, events) and stream state to the UI over WebSocket.
4. **Real documents.** PM, Architect, HR, Designer and Scrum agents run on the Claude Agent
   SDK and write real artifacts (PRD, architecture, team plan, OpenAPI spec, backlog). The PM
   holds a real Q&A with the client, and budgets come from real token counts.
5. **Real code.** Dev agents work in sandboxed containers on a GitHub repo, one branch and
   PR per story. The Tech Lead reviews and CI runs the tests.
6. **Real testing and deploy.** QA runs tests against acceptance criteria, Performance QA
   runs k6 load tests, and DevOps deploys a preview URL, then production.
7. **Multi-client.** Client logins, several projects at once, budgets and a cost dashboard,
   and daily reports by email or Slack.

Inspired by [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin): mailbox
messaging, task ledger, approval gates, budgets and a visual office floor.
