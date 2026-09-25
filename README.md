# Virtual Office

A product company where every employee is an AI agent. A client briefs an idea, and the
agents take it through intake, feasibility, design, staffing, sprint planning, build, QA,
performance testing and deployment. The client approves at each gate and gets a daily
report from the Scrum Master.

The office floor shows it all live: how many agents sit in each department, who is working,
and every task as it moves from room to room.

> **Status: v0.1, simulation.** The agents are simulated. The engine emits the same state the
> real agent backend will emit, so the floor, panels and reports stay the same when real
> Claude agents are plugged in.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5190, click **Brief the team**, and approve each gate as it comes up
(or tick **Auto-approve gates** and switch to 4× to watch a full project ship).

## The office

| Room | Department | Agents |
|---|---|---|
| Client Lounge | Client Services | Business Analyst |
| Product Office | Product | Product Manager |
| Architecture Room | Architecture | Solution Architect |
| Design Studio | Design | UI/UX Designer |
| HR & Staffing | People | HR / Staffing (hires the dev team per project) |
| Engineering Floor | Engineering | Tech Lead, Frontend, Backend, Mobile devs |
| Scrum War Room | Delivery | Scrum Master |
| Boardroom | Leadership | You, the client: every approval gate lands here |
| QA Lab | Quality | QA Tester (functional bugs) |
| Performance Lab | Performance | Performance QA (load, spike and soak tests; 1 lakh / 10 lakh users; one year of data growth) |
| Server Room | DevOps | DevOps Engineer (CI/CD, deploys) |

## The pipeline

```
Intake ─✋1─ Feasibility ─✋2─ Design ─✋3─ Staffing ─ Planning ─✋4─ Build ─✋5─ Release ─✋6─ Launch ─ Shipped
```

| Gate | You approve |
|---|---|
| 1 | Requirements brief (BA) |
| 2 | Go / No-Go: PRD + effort and cost estimate |
| 3 | Architecture, wireframes, scalability targets |
| 4 | Sprint backlog with acceptance criteria |
| 5 | Sprint demo / UAT |
| 6 | Go live, after the full load test |

During build, every story moves through
`Engineering (build) → Engineering (code review) → QA Lab → Performance Lab (if it's on a hot path) → Server Room`.
A QA bug or a failed load test sends it back to Engineering, and that loop is visible on the
floor and in each task's room trail.

## What's on screen

- **Floor.** Each room shows its headcount and open task count. Avatars pulse while working
  and walk between rooms. Tasks fly between rooms as cards: yellow for documents, blue for
  stories, amber for approvals.
- **Overview.** Current phase, headcount per department, and the delivery pipeline.
- **Tasks.** Every task with its current room, assignee, and the full trail of rooms it passed through.
- **Activity.** A live feed of everything that happened.
- **Reports.** The Scrum Master's daily report, plus one on demand. Reports are built only
  from ledger facts (stories by stage, bugs, performance issues, blockers, pending approvals),
  never from an LLM guess.

## Code map

```
src/domain/types.ts     Agent, Task, Flight, Approval, StatusReport, OfficeState
src/domain/office.ts    Rooms, roles, core staff, hire pool, story stages, phases + gates
src/sim/engine.ts       Simulation engine: phase state machine, assignment, work, rework, reports
src/components/Floor.tsx      SVG office floor: rooms, avatars, flying tasks
src/components/SidePanel.tsx  Brief form, approvals, overview, tasks, activity, reports
src/components/Roster.tsx     Staff strip
```

## Roadmap

1. **v0.1 (this).** Office floor, full SDLC pipeline, gates, daily reports, all simulated.
2. **Backend.** Move the engine to a Node service with Postgres (projects, phases, tasks,
   approvals, events) and stream state to the UI over WebSocket.
3. **Real documents.** BA, PM, Architect, Designer and Scrum agents run on the Claude Agent
   SDK and write real artifacts (brief, PRD, architecture, OpenAPI spec, backlog). The BA
   holds a real Q&A with the client.
4. **Real code.** Dev agents work in sandboxed containers on a GitHub repo, one branch and
   PR per story. The Tech Lead reviews and CI runs the tests.
5. **Real testing and deploy.** QA runs tests against acceptance criteria, Performance QA
   runs k6 load tests, and DevOps deploys a preview URL, then production.
6. **Multi-client.** Client logins, several projects at once, budgets and a cost dashboard,
   and daily reports by email or Slack.

Inspired by [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin): mailbox
messaging, task ledger, approval gates, budgets and a visual office floor.
