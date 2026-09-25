export type RoomId =
  | 'reception'
  | 'product'
  | 'architecture'
  | 'design'
  | 'hr'
  | 'engineering'
  | 'war'
  | 'board'
  | 'qa'
  | 'perf'
  | 'server';

export type Role =
  | 'client'
  | 'pm'
  | 'hr'
  | 'architect'
  | 'designer'
  | 'scrum'
  | 'lead'
  | 'fe'
  | 'be'
  | 'fullstack'
  | 'mobile'
  | 'devops'
  | 'qa'
  | 'perf';

export interface Room {
  id: RoomId;
  name: string;
  dept: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AgentStatus = 'idle' | 'working' | 'walking' | 'meeting';

export interface Agent {
  id: string;
  name: string;
  role: Role;
  home: RoomId;
  /** Room the agent is physically in right now. */
  at: RoomId;
  status: AgentStatus;
  taskId?: string;
  /** Rooms still to visit (stand-up tour, carrying a doc to the boardroom…). */
  route: RoomId[];
  nextMoveAt: number;
  hiredDay: number;
  tasksDone: number;
  tokensUsed: number;
}

export type TaskKind = 'doc' | 'story' | 'hire' | 'approval';

/** Where a story is in the delivery line. */
export type StoryStage = 'build' | 'review' | 'qa' | 'perf' | 'deploy';

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  phase: PhaseId;
  role: Role;
  room: RoomId;
  inTransit: boolean;
  /** Agent this task was handed to. Only they will pick it up. */
  owner?: string;
  /** Agent who handed it over most recently. */
  by?: string;
  /** Dev who built a story, so bugs go back to the same person. */
  builder?: string;
  /** Role that should be hired when a `hire` task completes. */
  hireRole?: Role;
  /** Side effect when a doc is finished: the Architect's team plan or the PM's budget. */
  effect?: 'plan' | 'budget';
  stage?: StoryStage;
  rework?: 'bug' | 'perf';
  needsPerf?: boolean;
  bugs: number;
  perfIssues: number;
  progress: number;
  work: number;
  done: boolean;
  createdTick: number;
  /** Every room this task has passed through, in order. */
  trail: RoomId[];
}

export interface Flight {
  id: string;
  taskId: string;
  label: string;
  caption: string;
  kind: TaskKind;
  from: RoomId;
  to: RoomId;
  fromAgent?: string;
  toAgent?: string;
  landAt: number;
  startWall: number;
  durationMs: number;
}

export interface Handoff {
  id: number;
  tick: number;
  day: number;
  taskId: string;
  title: string;
  fromName: string;
  toName: string;
  fromRoom: RoomId;
  toRoom: RoomId;
}

export type PhaseId =
  | 'idle'
  | 'intake'
  | 'requirements'
  | 'architecture'
  | 'hiring'
  | 'budget'
  | 'planning'
  | 'build'
  | 'release'
  | 'launch'
  | 'shipped';

export interface StoryPlan {
  title: string;
  role: Role;
  needsPerf: boolean;
}

export interface TeamPlan {
  team: { role: Role; count: number; why: string }[];
  stories: StoryPlan[];
}

export interface BudgetLine {
  role: Role;
  headcount: number;
  tasks: number;
  tokens: number;
}

export interface Budget {
  lines: BudgetLine[];
  subtotal: number;
  buffer: number;
  total: number;
  usd: number;
}

export interface Approval {
  id: string;
  gate: number;
  title: string;
  summary: string;
  phase: PhaseId;
  openedTick: number;
}

export interface LogEntry {
  id: number;
  tick: number;
  day: number;
  text: string;
  room?: RoomId;
  tone: 'info' | 'move' | 'done' | 'gate' | 'warn' | 'hire' | 'report';
}

export interface StatusReport {
  id: string;
  day: number;
  tick: number;
  phase: PhaseId;
  headline: string;
  stories: { total: number; done: number; byStage: Record<StoryStage, number> };
  bugsFound: number;
  perfIssues: number;
  tokens: { used: number; budget: number };
  headcount: { dept: string; count: number }[];
  pendingApprovals: string[];
  blockers: string[];
  next: string[];
}

export interface OfficeState {
  tick: number;
  day: number;
  phase: PhaseId;
  project?: { name: string; brief: string; startedTick: number };
  plan?: TeamPlan;
  budget?: Budget;
  tokensUsed: number;
  agents: Agent[];
  tasks: Task[];
  flights: Flight[];
  handoffs: Handoff[];
  approvals: Approval[];
  log: LogEntry[];
  reports: StatusReport[];
  paused: boolean;
  speed: number;
  autoApprove: boolean;
}
