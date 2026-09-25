import {
  DEV_ROLES,
  FOUNDERS,
  PHASE_BY_ID,
  planTeam,
  ROLES,
  DEPT_ROOMS,
  STORY_ORDER,
  STORY_STAGES,
  TALENT,
  TOKENS_PER_TICK,
  USD_PER_M_TOKENS,
  type DocSpec,
} from '../domain/office';
import type {
  Agent,
  Budget,
  BudgetLine,
  LogEntry,
  OfficeState,
  PhaseId,
  Role,
  RoomId,
  StatusReport,
  StoryPlan,
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
/** Headroom the PM adds to the estimate for bug fixes and performance rework. */
const BUDGET_BUFFER = 0.2;

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const avg = ([lo, hi]: [number, number]) => (lo + hi) / 2;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`;

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
  private budgetWarned = 0;

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
      tasks: s.tasks.map((t) => ({ ...t, trail: [...t.trail] })),
      flights: s.flights.map((f) => ({ ...f })),
      handoffs: s.handoffs.slice(-300),
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

  /** Advance exactly one tick while paused, to follow the office step by step. */
  stepOnce() {
    this.step();
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
    this.budgetWarned = 0;
    this.s = this.initial();
    this.emit();
  }

  submitBrief(name: string, brief: string) {
    if (this.s.phase !== 'idle') return;
    this.s.project = { name, brief, startedTick: this.s.tick };
    this.log(`New project: “${name}”. You are briefing Rohan (Product Manager).`, 'gate', 'board');
    this.enterPhase('intake');
    this.emit();
  }

  approve(id: string) {
    const ap = this.s.approvals.find((a) => a.id === id);
    if (!ap) return;
    this.s.approvals = this.s.approvals.filter((a) => a.id !== id);
    this.log(`You approved Gate ${ap.gate}: ${ap.title}.`, 'gate', 'board');
    for (const a of this.s.agents) if (a.status === 'meeting') this.sendHome(a);
    const def = PHASE_BY_ID[ap.phase];
    if (def) this.enterPhase(def.next);
    this.emit();
  }

  requestChanges(id: string) {
    const ap = this.s.approvals.find((a) => a.id === id);
    if (!ap) return;
    this.s.approvals = this.s.approvals.filter((a) => a.id !== id);
    for (const a of this.s.agents) if (a.status === 'meeting') this.sendHome(a);
    this.log(`You asked for changes at Gate ${ap.gate}.`, 'warn', 'board');
    const you = this.byRole('client');
    if (ap.phase === 'build') {
      this.createStory({ title: 'UAT feedback fixes', role: this.devRoles()[0] ?? 'fullstack', needsPerf: false }, you);
    } else {
      const doc = PHASE_BY_ID[ap.phase]?.docs[0];
      if (doc) this.createDoc({ ...doc, title: `${doc.title} (revision)`, work: Math.ceil(doc.work / 2) }, ap.phase, you);
    }
    this.emit();
  }

  /** Scrum Master's on-demand status report. */
  requestReport() {
    if (this.s.phase === 'idle') return;
    const r = this.buildReport();
    this.s.reports.push(r);
    const scrum = this.byRole('scrum');
    this.log(`${scrum ? `${scrum.name} (Scrum Master)` : 'Rohan (PM)'} filed a status report: ${r.headline}`, 'report', scrum ? 'war' : 'product');
    this.emit();
  }

  // ---- Setup ----------------------------------------------------------------

  private initial(): OfficeState {
    return {
      tick: 0,
      day: 1,
      phase: 'idle',
      tokensUsed: 0,
      agents: FOUNDERS.map((p) => this.makeAgent(p.name, p.role, 1)),
      tasks: [],
      flights: [],
      handoffs: [],
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
    const arriving = at !== undefined && at !== home;
    return {
      id: `ag-${role}-${name.toLowerCase()}`,
      name,
      role,
      home,
      at: at ?? home,
      status: arriving ? 'walking' : 'idle',
      route: arriving ? [home] : [],
      nextMoveAt: 0,
      hiredDay: day,
      tasksDone: 0,
      tokensUsed: 0,
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
      if (t.trail[t.trail.length - 1] !== f.to) t.trail.push(f.to);
    }
  }

  private moveAgents() {
    const s = this.s;
    for (const a of s.agents) {
      if (s.tick < a.nextMoveAt) continue;
      if (a.route.length) {
        a.at = a.route.shift()!;
        a.nextMoveAt = s.tick + WALK_TICKS;
      } else if (a.status === 'walking') {
        a.status = a.taskId ? 'working' : 'idle';
      }
    }
  }

  /** Each free agent picks up the oldest task that was handed to them. */
  private assignWork() {
    const s = this.s;
    const open = s.tasks
      .filter((t) => !t.done && !t.inTransit && t.kind !== 'approval' && !this.isActive(t))
      .sort((a, b) => a.createdTick - b.createdTick);
    for (const a of s.agents) {
      if (a.taskId || a.status === 'meeting' || a.role === 'client') continue;
      const t = open.find((x) => x.owner === a.id) ?? open.find((x) => !x.owner && x.role === a.role);
      if (!t) continue;
      open.splice(open.indexOf(t), 1);
      t.owner = a.id;
      a.taskId = t.id;
      if (a.at === t.room && !a.route.length) a.status = 'working';
      else this.walkTo(a, [t.room]);
    }
  }

  private isActive(t: Task) {
    return this.s.agents.some((a) => a.taskId === t.id);
  }

  private doWork() {
    const s = this.s;
    for (const a of s.agents) {
      if (!a.taskId) continue;
      const t = s.tasks.find((x) => x.id === a.taskId);
      if (!t || t.done) {
        a.taskId = undefined;
        continue;
      }
      if (a.at !== t.room || a.route.length) continue;
      a.status = 'working';
      const spend = TOKENS_PER_TICK[a.role];
      a.tokensUsed += spend;
      s.tokensUsed += spend;
      t.progress = Math.min(1, t.progress + 1 / t.work);
      if (t.progress >= 1) this.finish(t, a);
    }
    this.checkBudget();
  }

  private checkBudget() {
    const b = this.s.budget;
    if (!b) return;
    const pct = this.s.tokensUsed / b.total;
    if (pct >= 1 && this.budgetWarned < 2) {
      this.budgetWarned = 2;
      this.log(`Token budget exceeded: ${fmtTokens(this.s.tokensUsed)} used of ${fmtTokens(b.total)} approved.`, 'warn', 'board');
    } else if (pct >= 0.8 && this.budgetWarned < 1) {
      this.budgetWarned = 1;
      this.log(`80% of the token budget is used (${fmtTokens(this.s.tokensUsed)} of ${fmtTokens(b.total)}).`, 'warn', 'board');
    }
  }

  private finish(t: Task, a: Agent) {
    a.taskId = undefined;
    a.status = 'idle';
    a.tasksDone += 1;
    t.progress = 0;

    if (t.kind === 'hire') {
      t.done = true;
      this.hire(t.hireRole!, a);
      return;
    }

    if (t.kind === 'doc') {
      t.done = true;
      this.log(`${a.name} (${ROLES[a.role].label}) finished “${t.title}”.`, 'done', t.room);
      if (t.effect === 'plan') this.makePlan(a);
      if (t.effect === 'budget') this.makeBudget(a);
      return;
    }

    // Story: decide where it goes next, and who hands it to whom.
    const stage = t.stage!;
    if (stage === 'build') t.builder = a.id;
    if (stage === 'qa' && t.bugs < MAX_REWORK && Math.random() < BUG_RATE) {
      t.bugs += 1;
      this.rework(t, a, 'bug', `${a.name} found a bug in “${t.title}”.`);
      return;
    }
    if (stage === 'perf' && t.perfIssues < MAX_REWORK && Math.random() < PERF_ISSUE_RATE) {
      t.perfIssues += 1;
      this.rework(t, a, 'perf', `${a.name}: “${t.title}” slows down past 1 lakh users (p95 > 300 ms).`);
      return;
    }
    let next = STORY_ORDER[STORY_ORDER.indexOf(stage) + 1];
    if (next === 'perf' && (!t.needsPerf || !this.byRole('perf'))) next = 'deploy';
    if (!next) {
      t.done = true;
      this.log(`“${t.title}” is live on the preview environment.`, 'done', 'server');
      return;
    }
    t.rework = undefined;
    this.setStage(t, next, a);
  }

  private rework(t: Task, from: Agent, why: 'bug' | 'perf', msg: string) {
    t.rework = why;
    this.log(msg, 'warn', t.room);
    this.setStage(t, 'build', from, t.builder);
  }

  private setStage(t: Task, stage: StoryStage, from: Agent | undefined, ownerId?: string) {
    const def = STORY_STAGES[stage];
    t.stage = stage;
    let role: Role = def.role === 'dev' ? t.role : def.role;
    if (stage !== 'build') {
      if (role === 'lead' && !this.byRole('lead')) role = 'architect';
      if (!this.byRole(role)) role = 'devops';
    }
    const [lo, hi] = def.work;
    t.work = t.rework && stage === 'build' ? Math.ceil(rand(lo, hi) / 2) : rand(lo, hi);
    this.handOff(t, from, role, { ownerId });
  }

  private checkPhase() {
    const s = this.s;
    const def = PHASE_BY_ID[s.phase];
    if (!def) return;
    const phaseTasks = s.tasks.filter((t) => t.phase === s.phase && t.kind !== 'approval');
    if (!phaseTasks.length || phaseTasks.some((t) => !t.done)) return;
    if (s.approvals.some((a) => a.phase === s.phase)) return;
    // Wait until everyone hired has walked in before moving on.
    if (s.phase === 'hiring' && s.agents.some((a) => a.at !== a.home && a.status === 'walking')) return;

    if (def.gate) this.openGate(def.id);
    else this.enterPhase(def.next);
  }

  private openGate(phase: PhaseId) {
    const s = this.s;
    const gate = PHASE_BY_ID[phase]!.gate!;
    const lastDoc = [...s.tasks].reverse().find((t) => t.phase === phase && t.kind !== 'approval');
    const carrier = (lastDoc && s.agents.find((a) => a.id === lastDoc.owner && !a.taskId)) ?? this.byRole('pm');
    if (carrier) {
      this.walkTo(carrier, ['board']);
      carrier.status = 'meeting';
    }
    const t = this.newTask({ title: `Gate ${gate.n}`, kind: 'approval', phase, role: 'client', room: carrier?.at ?? 'product' });
    t.done = true; // the token is only a visual; the decision lives in s.approvals
    this.handOff(t, carrier, 'client');
    s.approvals.push({ id: `gate-${gate.n}-${s.tick}`, gate: gate.n, title: gate.title, summary: gate.summary, phase, openedTick: s.tick });
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
    this.log(`Phase started: ${def.label}.`, 'info');

    if (phase === 'hiring') {
      const architect = this.byRole('architect');
      let i = 0;
      for (const seat of s.plan?.team ?? []) {
        for (let n = 0; n < seat.count; n++) {
          this.createDoc(
            { title: `Hire: ${ROLES[seat.role].label}`, by: 'architect', role: 'hr', work: 3, kind: 'hire', hireRole: seat.role },
            phase,
            architect,
            i++,
          );
        }
      }
      return;
    }

    let i = 0;
    for (const d of def.docs) {
      if (!this.byRole(d.role)) continue; // role not on this project's team
      this.createDoc(d, phase, this.byRole(d.by), i++);
    }

    if (phase === 'build') {
      const scrum = this.byRole('scrum') ?? this.byRole('pm');
      (s.plan?.stories ?? []).forEach((p, idx) => this.createStory(p, scrum, idx));
      this.log(`${scrum?.name} is assigning ${s.plan?.stories.length ?? 0} stories to the developers.`, 'move', 'war');
    }
  }

  private createDoc(d: DocSpec, phase: PhaseId, from: Agent | undefined, delay = 0) {
    const t = this.newTask({ title: d.title, kind: d.kind ?? 'doc', phase, role: d.role, room: from?.at ?? ROLES[d.role].room });
    t.work = d.work;
    t.hireRole = d.hireRole;
    t.effect = d.effect;
    this.handOff(t, from, d.role, { delay });
  }

  private createStory(p: StoryPlan, from: Agent | undefined, delay = 0) {
    const s = this.s;
    let role = p.role;
    if (!this.byRole(role)) role = this.devRoles()[0] ?? 'fullstack';
    const t = this.newTask({ title: p.title, kind: 'story', phase: s.phase === 'build' ? 'build' : s.phase, role, room: from?.at ?? 'war' });
    t.needsPerf = p.needsPerf;
    t.stage = 'build';
    t.work = rand(...STORY_STAGES.build.work);
    t.createdTick = s.tick + delay;
    this.handOff(t, from, role, { delay });
  }

  private hire(role: Role, hr: Agent) {
    const s = this.s;
    const taken = new Set(s.agents.map((a) => a.name));
    const name = TALENT[role]?.find((n) => !taken.has(n)) ?? `${ROLES[role].label.split(' ')[0]} ${s.agents.length}`;
    const a = this.makeAgent(name, role, s.day, 'reception');
    a.nextMoveAt = s.tick + 2;
    s.agents.push(a);
    this.log(`${hr.name} hired ${name} as ${ROLES[role].label}. ${name} is walking from Reception to the ${ROLES[role].room === 'engineering' ? 'Engineering Floor' : 'team'}.`, 'hire', 'hr');
  }

  private makePlan(architect: Agent) {
    const s = this.s;
    s.plan = planTeam(s.project?.brief ?? '');
    const seats = s.plan.team.reduce((n, t) => n + t.count, 0);
    this.log(
      `${architect.name}'s team plan: ${plural(seats, 'hire', 'hires')} (${s.plan.team.map((t) => `${t.count} ${ROLES[t.role].label}`).join(', ')}) and ${plural(s.plan.stories.length, 'story', 'stories')} in scope.`,
      'info',
      'architecture',
    );
  }

  /** PM's estimate: tokens spent so far plus the expected cost of every remaining task. */
  private makeBudget(pm: Agent) {
    const s = this.s;
    const lines = new Map<Role, BudgetLine>();
    const line = (role: Role) => {
      if (!lines.has(role)) {
        const spent = s.agents.filter((a) => a.role === role).reduce((n, a) => n + a.tokensUsed, 0);
        lines.set(role, { role, headcount: s.agents.filter((a) => a.role === role).length, tasks: 0, tokens: spent });
      }
      return lines.get(role)!;
    };
    const add = (role: Role, work: number) => {
      const l = line(role);
      l.tasks += 1;
      l.tokens += work * TOKENS_PER_TICK[role];
    };
    for (const a of s.agents) if (a.role !== 'client') line(a.role);

    for (const phase of ['planning', 'release', 'launch'] as PhaseId[]) {
      for (const d of PHASE_BY_ID[phase]!.docs) if (this.byRole(d.role)) add(d.role, d.work);
    }
    for (const st of s.plan?.stories ?? []) {
      const dev = this.byRole(st.role) ? st.role : this.devRoles()[0] ?? 'fullstack';
      add(dev, avg(STORY_STAGES.build.work));
      add(this.byRole('lead') ? 'lead' : 'architect', avg(STORY_STAGES.review.work));
      if (this.byRole('qa')) add('qa', avg(STORY_STAGES.qa.work));
      if (st.needsPerf && this.byRole('perf')) add('perf', avg(STORY_STAGES.perf.work));
      if (this.byRole('devops')) add('devops', avg(STORY_STAGES.deploy.work));
    }

    const all = [...lines.values()].sort((a, b) => b.tokens - a.tokens);
    const subtotal = all.reduce((n, l) => n + l.tokens, 0);
    const buffer = Math.round(subtotal * BUDGET_BUFFER);
    const total = subtotal + buffer;
    const budget: Budget = { lines: all, subtotal, buffer, total, usd: (total / 1_000_000) * USD_PER_M_TOKENS };
    s.budget = budget;
    this.log(
      `${pm.name}'s token budget: ${fmtTokens(total)} tokens (≈ $${budget.usd.toFixed(2)}), including a ${BUDGET_BUFFER * 100}% buffer for rework.`,
      'info',
      'product',
    );
  }

  private dailyStandup() {
    const s = this.s;
    const scrum = this.byRole('scrum');
    if (scrum && !scrum.taskId && s.phase === 'build') this.walkTo(scrum, ['engineering', 'qa', 'perf', 'server', 'war']);
    const r = this.buildReport();
    s.reports.push(r);
    this.log(`Day ${r.day} report is ready: ${r.headline}`, 'report', scrum ? 'war' : 'product');
  }

  // ---- Helpers --------------------------------------------------------------

  private byRole(role: Role) {
    return this.s.agents.find((a) => a.role === role);
  }

  private devRoles() {
    return DEV_ROLES.filter((r) => this.byRole(r));
  }

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

  /**
   * One agent hands a task to another. Picks the least-busy agent in the role
   * (unless a specific owner is given), then flies the task from desk to desk.
   */
  private handOff(t: Task, from: Agent | undefined, role: Role, opts: { ownerId?: string; delay?: number } = {}) {
    const s = this.s;
    const owner =
      (opts.ownerId && s.agents.find((a) => a.id === opts.ownerId)) ||
      s.agents
        .filter((a) => a.role === role)
        .sort((a, b) => this.load(a) - this.load(b) || a.id.localeCompare(b.id))[0];
    t.owner = owner?.id;
    t.by = from?.id;
    const to = owner?.home ?? ROLES[role].room;
    const fromRoom = t.room;

    if (from && owner && from.id === owner.id && fromRoom === to) return; // writing it themselves

    const toName = owner?.name ?? ROLES[role].label;
    const fromName = from?.name ?? 'Office';
    s.handoffs.push({ id: ++this.seq, tick: s.tick, day: s.day, taskId: t.id, title: t.title, fromName, toName, fromRoom, toRoom: to });
    if (t.kind !== 'approval') this.log(`${fromName} → ${toName}: “${t.title}”.`, 'move', to);

    const delay = opts.delay ?? 0;
    const tickMs = TICK_MS / s.speed;
    s.flights.push({
      id: `F-${++this.seq}`,
      taskId: t.id,
      label: t.kind === 'approval' ? t.title : t.id,
      caption: `${fromName} → ${toName}`,
      kind: t.kind,
      from: fromRoom,
      to,
      fromAgent: from?.id,
      toAgent: owner?.id,
      landAt: s.tick + delay + FLIGHT_TICKS,
      startWall: performance.now() + delay * tickMs,
      durationMs: FLIGHT_TICKS * tickMs,
    });
    t.inTransit = true;
  }

  private load(a: Agent) {
    return this.s.tasks.filter((t) => t.owner === a.id && !t.done).length;
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
    const budget = s.budget?.total ?? 0;

    const headcount = DEPT_ROOMS.map((r) => ({ dept: r.dept, count: s.agents.filter((a) => a.home === r.id).length }));

    const blockers: string[] = [];
    for (const ap of s.approvals) blockers.push(`Waiting for your approval at Gate ${ap.gate} (${ap.title}).`);
    const queued = s.tasks.filter((t) => !t.done && !t.inTransit && t.kind !== 'approval' && !this.isActive(t) && s.tick - t.createdTick > 20);
    if (queued.length) blockers.push(`${plural(queued.length, 'item is', 'items are')} queued behind busy agents: ${queued.slice(0, 3).map((t) => t.title).join(', ')}.`);
    const reworked = stories.filter((t) => !t.done && t.rework);
    if (reworked.length) blockers.push(`${plural(reworked.length, 'story is', 'stories are')} in rework (bugs / performance).`);
    if (budget && s.tokensUsed > budget) blockers.push(`Over the approved token budget by ${fmtTokens(s.tokensUsed - budget)}.`);

    const def = PHASE_BY_ID[s.phase];
    let headline: string;
    if (s.phase === 'shipped')
      headline = `Shipped. ${plural(done, 'story', 'stories')} live, ${plural(bugsFound, 'bug', 'bugs')} and ${plural(perfIssues, 'performance issue', 'performance issues')} fixed before launch.`;
    else if (s.phase === 'build') headline = `${done}/${stories.length} stories done, ${byStage.build} in build, ${byStage.qa + byStage.perf} in testing.`;
    else if (s.phase === 'hiring') {
      const hires = s.tasks.filter((t) => t.kind === 'hire' && t.phase === 'hiring');
      headline = `Hiring: ${hires.filter((t) => t.done).length}/${hires.length} seats filled.`;
    } else {
      const docs = s.tasks.filter((t) => t.phase === s.phase && t.kind === 'doc');
      headline = `${def?.label ?? s.phase}: ${docs.filter((t) => t.done).length}/${docs.length} deliverables complete.`;
    }

    const next: string[] = [];
    if (s.approvals.length) next.push('Your approval unblocks the next phase.');
    else if (s.phase === 'build') {
      if (byStage.qa + byStage.perf) next.push('QA and Performance labs are clearing the test queue.');
      if (byStage.build) next.push('Engineering continues on open stories.');
    } else if (def) next.push(`Finish ${def.label.toLowerCase()}, then ${def.gate ? `Gate ${def.gate.n}` : (PHASE_BY_ID[def.next]?.label ?? 'launch')}.`);

    return {
      id: `R-${++this.seq}`,
      day: s.day,
      tick: s.tick,
      phase: s.phase,
      headline,
      stories: { total: stories.length, done, byStage },
      bugsFound,
      perfIssues,
      tokens: { used: s.tokensUsed, budget },
      headcount,
      pendingApprovals: s.approvals.map((a) => `Gate ${a.gate}: ${a.title}`),
      blockers,
      next,
    };
  }
}
