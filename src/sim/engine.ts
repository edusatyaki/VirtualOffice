import {
  CORE_STAFF,
  HIRE_POOL,
  PHASE_BY_ID,
  ROLES,
  ROOMS,
  STORY_ORDER,
  STORY_STAGES,
  STORY_TEMPLATES,
} from '../domain/office';
import type {
  Agent,
  LogEntry,
  OfficeState,
  PhaseId,
  Role,
  RoomId,
  StatusReport,
  StoryStage,
  Task,
} from '../domain/types';

export const TICK_MS = 600;
export const TICKS_PER_DAY = 60;
const FLIGHT_TICKS = 3;
const WALK_TICKS = 3;
const AUTO_APPROVE_AFTER = 4;
const BUG_RATE = 0.25;
const PERF_ISSUE_RATE = 0.3;
const MAX_REWORK = 2;

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Simulated office. It drives the same state the real agent backend will emit,
 * so the floor, panels and reports don't change when real agents plug in.
 */
export class OfficeSim {
  private s: OfficeState;
  private view: OfficeState;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private seq = 0;
  private logSeq = 0;

  constructor() {
    this.s = this.initial();
    this.view = this.snapshot();
  }

  // ---- React bindings -------------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.view;

  private emit() {
    this.view = this.snapshot();
    this.listeners.forEach((fn) => fn());
  }

  private snapshot(): OfficeState {
    const s = this.s;
    return {
      ...s,
      agents: s.agents.map((a) => ({ ...a, route: [...a.route] })),
      tasks: s.tasks.map((t) => ({ ...t })),
      flights: s.flights.map((f) => ({ ...f })),
      approvals: [...s.approvals],
      log: s.log.slice(-250),
      reports: [...s.reports],
    };
  }

  // ---- Controls -------------------------------------------------------------

  start() {
    const loop = () => {
      if (!this.s.paused) this.step();
      this.timer = setTimeout(loop, TICK_MS / this.s.speed);
    };
    clearTimeout(this.timer);
    this.timer = setTimeout(loop, TICK_MS / this.s.speed);
  }

  stop() {
    clearTimeout(this.timer);
  }

  setPaused(paused: boolean) {
    this.s.paused = paused;
    this.emit();
  }

  setSpeed(speed: number) {
    this.s.speed = speed;
    this.emit();
  }

  setAutoApprove(on: boolean) {
    this.s.autoApprove = on;
    this.emit();
  }

  reset() {
    this.s = this.initial();
    this.emit();
  }

  submitBrief(name: string, brief: string) {
    if (this.s.phase !== 'idle') return;
    this.s.project = { name, brief, startedTick: this.s.tick };
    this.log(`New client brief: “${name}”. Asha (BA) is taking the meeting.`, 'gate', 'lounge');
    this.enterPhase('intake');
    this.emit();
  }

  approve(id: string) {
    const ap = this.s.approvals.find((a) => a.id === id);
    if (!ap) return;
    this.s.approvals = this.s.approvals.filter((a) => a.id !== id);
    this.log(`Gate ${ap.gate} approved: ${ap.title}.`, 'gate', 'board');
    const def = PHASE_BY_ID[ap.phase];
    // Whoever carried the doc up to the boardroom heads back to their desk.
    for (const a of this.s.agents) if (a.status === 'meeting') this.sendHome(a);
    if (def) this.enterPhase(def.next);
    this.emit();
  }

  requestChanges(id: string) {
    const ap = this.s.approvals.find((a) => a.id === id);
    if (!ap) return;
    this.s.approvals = this.s.approvals.filter((a) => a.id !== id);
    for (const a of this.s.agents) if (a.status === 'meeting') this.sendHome(a);
    this.log(`Changes requested at gate ${ap.gate}. The ${ap.phase} team is revising.`, 'warn', 'board');
    const def = PHASE_BY_ID[ap.phase];
    const doc = def?.docs[0];
    if (doc) this.createDoc(`${doc.title} (revision)`, doc.role, Math.ceil(doc.work / 2), ap.phase, 'board');
    this.emit();
  }

  /** Scrum Master's on-demand status report. */
  requestReport() {
    if (this.s.phase === 'idle') return;
    const r = this.buildReport();
    this.s.reports.push(r);
    this.log(`Vikram (Scrum Master) filed a status report: ${r.headline}`, 'report', 'war');
    this.emit();
  }

  // ---- Setup ----------------------------------------------------------------

  private initial(): OfficeState {
    const agents = CORE_STAFF.map((p) => this.makeAgent(p.name, p.role, 1));
    return {
      tick: 0,
      day: 1,
      phase: 'idle',
      agents,
      tasks: [],
      flights: [],
      approvals: [],
      log: [],
      reports: [],
      paused: false,
      speed: 1,
      autoApprove: false,
    };
  }

  private makeAgent(name: string, role: Role, day: number, at?: RoomId): Agent {
    const home = ROLES[role].room;
    return {
      id: `ag-${role}-${name.toLowerCase()}`,
      name,
      role,
      home,
      at: at ?? home,
      status: at && at !== home ? 'walking' : 'idle',
      route: at && at !== home ? [home] : [],
      nextMoveAt: 0,
      hiredDay: day,
      tasksDone: 0,
    };
  }

  // ---- Simulation step ------------------------------------------------------

  private step() {
    const s = this.s;
    s.tick += 1;
    s.day = Math.floor(s.tick / TICKS_PER_DAY) + 1;

    this.landFlights();
    this.moveAgents();
    this.assignWork();
    this.doWork();
    this.checkPhase();
    this.autoApprove();

    if (s.tick % TICKS_PER_DAY === 0 && s.phase !== 'idle' && s.phase !== 'shipped') this.dailyStandup();

    this.emit();
  }

  private landFlights() {
    const s = this.s;
    const landed = s.flights.filter((f) => f.landAt <= s.tick);
    if (!landed.length) return;
    s.flights = s.flights.filter((f) => f.landAt > s.tick);
    for (const f of landed) {
      const t = s.tasks.find((x) => x.id === f.taskId);
      if (!t) continue;
      t.inTransit = false;
      t.room = f.to;
      t.trail.push(f.to);
    }
  }

  private moveAgents() {
    const s = this.s;
    for (const a of s.agents) {
      if (s.tick < a.nextMoveAt) continue;
      if (a.route.length) {
        a.at = a.route.shift()!;
        a.nextMoveAt = s.tick + WALK_TICKS;
        if (!a.route.length && a.status === 'walking') a.status = a.taskId ? 'working' : 'idle';
      } else if (a.status === 'walking') {
        a.status = a.taskId ? 'working' : 'idle';
      }
    }
  }

  private assignWork() {
    const s = this.s;
    const open = s.tasks
      .filter((t) => !t.done && !t.inTransit && !t.assignee && t.kind !== 'approval')
      .sort((a, b) => a.createdTick - b.createdTick);
    for (const t of open) {
      const agent = s.agents
        .filter((a) => a.role === t.role && !a.taskId && a.status !== 'meeting')
        .sort((a, b) => a.tasksDone - b.tasksDone)[0];
      if (!agent) continue;
      t.assignee = agent.id;
      agent.taskId = t.id;
      if (agent.at === t.room) agent.status = 'working';
      else this.walkTo(agent, [t.room]);
    }
  }

  private doWork() {
    const s = this.s;
    for (const a of s.agents) {
      if (!a.taskId) continue;
      const t = s.tasks.find((x) => x.id === a.taskId);
      if (!t) {
        a.taskId = undefined;
        continue;
      }
      if (a.at !== t.room || a.status === 'walking') continue;
      a.status = 'working';
      t.progress = Math.min(1, t.progress + 1 / t.work);
      if (t.progress >= 1) this.finish(t, a);
    }
  }

  private finish(t: Task, a: Agent) {
    a.taskId = undefined;
    a.status = 'idle';
    a.tasksDone += 1;
    t.assignee = undefined;
    t.progress = 0;

    if (t.kind === 'doc') {
      t.done = true;
      this.log(`${a.name} (${ROLES[a.role].label}) finished “${t.title}”.`, 'done', t.room);
      if (t.phase === 'staffing') this.hireTeam();
      return;
    }

    // Story: decide where it goes next.
    const stage = t.stage!;
    if (stage === 'qa' && t.bugs < MAX_REWORK && Math.random() < BUG_RATE) {
      t.bugs += 1;
      this.rework(t, 'bug', `${a.name} found a bug in “${t.title}”. Sent back to engineering.`);
      return;
    }
    if (stage === 'perf' && t.perfIssues < MAX_REWORK && Math.random() < PERF_ISSUE_RATE) {
      t.perfIssues += 1;
      this.rework(t, 'perf', `${a.name}: “${t.title}” slows down past 1 lakh users (p95 > 300 ms). Optimisation needed.`);
      return;
    }
    let next = STORY_ORDER[STORY_ORDER.indexOf(stage) + 1];
    if (next === 'perf' && !t.needsPerf) next = 'deploy';
    if (!next) {
      t.done = true;
      this.log(`“${t.title}” is live on the preview environment.`, 'done', 'server');
      return;
    }
    const verb: Record<StoryStage, string> = {
      build: 'built',
      review: 'reviewed',
      qa: 'passed QA',
      perf: 'passed the load test',
      deploy: 'deployed',
    };
    t.rework = undefined;
    this.log(`${a.name}: “${t.title}” ${verb[stage]} → ${STORY_STAGES[next].label}.`, 'move', t.room);
    this.setStage(t, next);
  }

  private rework(t: Task, why: 'bug' | 'perf', msg: string) {
    t.rework = why;
    this.log(msg, 'warn', t.room);
    this.setStage(t, 'build');
  }

  private setStage(t: Task, stage: StoryStage) {
    const def = STORY_STAGES[stage];
    t.stage = stage;
    t.role = def.role === 'dev' ? this.devRoleFor(t) : def.role;
    const [lo, hi] = def.work;
    t.work = t.rework && stage === 'build' ? Math.ceil(rand(lo, hi) / 2) : rand(lo, hi);
    this.moveTask(t, def.room);
  }

  private devRoleFor(t: Task): Role {
    return STORY_TEMPLATES.find((x) => t.title === x.title)?.role ?? 'be';
  }

  private checkPhase() {
    const s = this.s;
    const def = PHASE_BY_ID[s.phase];
    if (!def) return;
    const phaseTasks = s.tasks.filter((t) => t.phase === s.phase && t.kind !== 'approval');
    if (!phaseTasks.length || phaseTasks.some((t) => !t.done)) return;
    if (s.approvals.some((a) => a.phase === s.phase)) return;
    if (s.tasks.some((t) => t.phase === s.phase && t.kind === 'approval' && !t.done)) return;

    if (def.gate) this.openGate(def.id);
    else this.enterPhase(def.next);
  }

  private openGate(phase: PhaseId) {
    const s = this.s;
    const def = PHASE_BY_ID[phase]!;
    const gate = def.gate!;
    // The team's lead walks the paperwork up to the boardroom.
    const lastDoc = [...s.tasks].reverse().find((t) => t.phase === phase && t.kind !== 'approval');
    const from = lastDoc?.room ?? def.origin;
    const carrier = s.agents.find((a) => a.role === (lastDoc?.role ?? 'pm') && !a.taskId);
    if (carrier) {
      this.walkTo(carrier, ['board']);
      carrier.status = 'meeting';
    }
    const t = this.newTask({ title: `Gate ${gate.n}`, kind: 'approval', phase, role: 'client', room: from });
    t.done = true; // the token is only a visual; the approval lives in s.approvals
    this.moveTask(t, 'board');
    s.approvals.push({
      id: `gate-${gate.n}-${s.tick}`,
      gate: gate.n,
      title: gate.title,
      summary: gate.summary,
      phase,
      openedTick: s.tick,
    });
    this.log(`Waiting on you: Gate ${gate.n}, ${gate.title}.`, 'gate', 'board');
  }

  private autoApprove() {
    const s = this.s;
    if (!s.autoApprove) return;
    const due = s.approvals.find((a) => s.tick - a.openedTick >= AUTO_APPROVE_AFTER);
    if (due) this.approve(due.id);
  }

  private enterPhase(phase: PhaseId) {
    const s = this.s;
    s.phase = phase;
    if (phase === 'shipped') {
      this.log(`🚀 ${s.project?.name ?? 'Project'} is live in production.`, 'gate', 'server');
      s.reports.push(this.buildReport());
      for (const a of s.agents) this.sendHome(a);
      return;
    }
    const def = PHASE_BY_ID[phase]!;
    this.log(`Phase started: ${def.label}.`, 'info', def.origin);
    for (const d of def.docs) this.createDoc(d.title, d.role, d.work, phase, def.origin);
    if (phase === 'build') this.createStories();
  }

  private createDoc(title: string, role: Role, work: number, phase: PhaseId, from: RoomId) {
    const t = this.newTask({ title, kind: 'doc', phase, role, room: from });
    t.work = work;
    this.moveTask(t, ROLES[role].room);
  }

  private createStories() {
    const s = this.s;
    const count = rand(7, STORY_TEMPLATES.length);
    const picks = STORY_TEMPLATES.slice(0, count);
    this.log(`Vikram released ${picks.length} stories from the backlog to engineering.`, 'move', 'war');
    for (const p of picks) {
      const t = this.newTask({ title: p.title, kind: 'story', phase: 'build', role: p.role, room: 'war' });
      t.needsPerf = p.needsPerf;
      t.stage = 'build';
      t.work = rand(...STORY_STAGES.build.work);
      t.createdTick = s.tick + picks.indexOf(p);
      this.moveTask(t, 'engineering');
    }
  }

  private hireTeam() {
    const s = this.s;
    for (const h of HIRE_POOL) {
      if (s.agents.some((a) => a.name === h.name)) continue;
      const a = this.makeAgent(h.name, h.role, s.day, 'lounge');
      a.nextMoveAt = s.tick + 1 + HIRE_POOL.indexOf(h);
      s.agents.push(a);
      this.log(`Neha hired ${h.name} as ${ROLES[h.role].label}. Walking to the Engineering Floor.`, 'hire', 'hr');
    }
  }

  private dailyStandup() {
    const s = this.s;
    const scrum = s.agents.find((a) => a.role === 'scrum');
    if (scrum && !scrum.taskId) {
      this.walkTo(scrum, ['engineering', 'qa', 'perf', 'server', 'war']);
    }
    const r = this.buildReport();
    s.reports.push(r);
    this.log(`Day ${r.day} stand-up report is ready: ${r.headline}`, 'report', 'war');
  }

  // ---- Helpers --------------------------------------------------------------

  private newTask(p: Pick<Task, 'title' | 'kind' | 'phase' | 'role' | 'room'>): Task {
    const t: Task = {
      id: `T-${++this.seq}`,
      ...p,
      inTransit: false,
      bugs: 0,
      perfIssues: 0,
      progress: 0,
      work: 1,
      done: false,
      createdTick: this.s.tick,
      trail: [p.room],
    };
    this.s.tasks.push(t);
    return t;
  }

  private moveTask(t: Task, to: RoomId) {
    if (t.room === to) return;
    const s = this.s;
    s.flights.push({
      id: `F-${++this.seq}`,
      taskId: t.id,
      label: t.kind === 'approval' ? t.title : t.id,
      kind: t.kind,
      from: t.room,
      to,
      landAt: s.tick + FLIGHT_TICKS,
      startWall: performance.now(),
      durationMs: (FLIGHT_TICKS * TICK_MS) / s.speed,
    });
    t.inTransit = true;
  }

  private walkTo(a: Agent, route: RoomId[]) {
    a.route = route;
    a.status = 'walking';
    a.nextMoveAt = this.s.tick;
  }

  private sendHome(a: Agent) {
    if (a.at === a.home && !a.route.length) {
      if (a.status === 'meeting' || a.status === 'walking') a.status = a.taskId ? 'working' : 'idle';
      return;
    }
    this.walkTo(a, [a.home]);
  }

  private log(text: string, tone: LogEntry['tone'], room?: RoomId) {
    this.s.log.push({ id: ++this.logSeq, tick: this.s.tick, day: this.s.day, text, room, tone });
  }

  /** Built only from ledger facts, so the report can't invent progress. */
  private buildReport(): StatusReport {
    const s = this.s;
    const stories = s.tasks.filter((t) => t.kind === 'story');
    const byStage: Record<StoryStage, number> = { build: 0, review: 0, qa: 0, perf: 0, deploy: 0 };
    for (const t of stories) if (!t.done && t.stage) byStage[t.stage] += 1;
    const done = stories.filter((t) => t.done).length;
    const bugsFound = stories.reduce((n, t) => n + t.bugs, 0);
    const perfIssues = stories.reduce((n, t) => n + t.perfIssues, 0);

    const headcount = ROOMS.filter((r) => r.id !== 'board').map((r) => ({
      dept: r.dept,
      count: s.agents.filter((a) => a.home === r.id).length,
    }));

    const blockers: string[] = [];
    for (const ap of s.approvals) blockers.push(`Waiting for your approval at Gate ${ap.gate} (${ap.title}).`);
    const stuck = s.tasks.filter((t) => !t.done && !t.assignee && !t.inTransit && t.kind !== 'approval' && s.tick - t.createdTick > 20);
    if (stuck.length) blockers.push(`${stuck.length} item(s) queued with no free agent: ${stuck.slice(0, 3).map((t) => t.title).join(', ')}.`);
    const reworked = stories.filter((t) => !t.done && t.rework);
    if (reworked.length) blockers.push(`${reworked.length} stor${reworked.length > 1 ? 'ies' : 'y'} in rework (bugs / performance).`);

    const def = PHASE_BY_ID[s.phase];
    let headline: string;
    if (s.phase === 'shipped') headline = `Shipped. ${plural(done, 'story', 'stories')} live, ${plural(bugsFound, 'bug', 'bugs')} and ${plural(perfIssues, 'performance issue', 'performance issues')} fixed before launch.`;
    else if (s.phase === 'build') headline = `${done}/${stories.length} stories done, ${byStage.build} in build, ${byStage.qa + byStage.perf} in testing.`;
    else headline = `${def?.label ?? s.phase} phase: ${s.tasks.filter((t) => t.phase === s.phase && t.kind === 'doc' && t.done).length}/${def?.docs.length ?? 0} documents complete.`;

    const next: string[] = [];
    if (s.approvals.length) next.push('Your approval unblocks the next phase.');
    else if (s.phase === 'build') {
      if (byStage.qa + byStage.perf) next.push('QA and Performance labs are clearing the test queue.');
      if (byStage.build) next.push('Engineering continues on open stories.');
    } else if (def) next.push(`Finish ${def.label.toLowerCase()} deliverables, then ${def.gate ? `Gate ${def.gate.n}` : PHASE_BY_ID[def.next]?.label ?? 'launch'}.`);

    return {
      id: `R-${++this.seq}`,
      day: s.day,
      tick: s.tick,
      phase: s.phase,
      headline,
      stories: { total: stories.length, done, byStage },
      bugsFound,
      perfIssues,
      headcount,
      pendingApprovals: s.approvals.map((a) => `Gate ${a.gate}: ${a.title}`),
      blockers,
      next,
    };
  }
}
