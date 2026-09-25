export type RoomId =
  | 'lounge'
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
  | 'ba'
  | 'pm'
  | 'architect'
  | 'designer'
  | 'hr'
  | 'scrum'
  | 'lead'
  | 'fe'
  | 'be'
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
}

export type TaskKind = 'doc' | 'story' | 'approval';

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
  stage?: StoryStage;
  /** Rework reason when a story is bounced back to engineering. */
  rework?: 'bug' | 'perf';
  needsPerf?: boolean;
  bugs: number;
  perfIssues: number;
  assignee?: string;
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
  kind: TaskKind;
  from: RoomId;
  to: RoomId;
  landAt: number;
  startWall: number;
  durationMs: number;
}

export type PhaseId =
  | 'idle'
  | 'intake'
  | 'feasibility'
  | 'design'
  | 'staffing'
  | 'planning'
  | 'build'
  | 'release'
  | 'launch'
  | 'shipped';

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
  agents: Agent[];
  tasks: Task[];
  flights: Flight[];
  approvals: Approval[];
  log: LogEntry[];
  reports: StatusReport[];
  paused: boolean;
  speed: number;
  autoApprove: boolean;
}
