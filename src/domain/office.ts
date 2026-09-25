import type { PhaseId, Role, Room, RoomId, StoryPlan, StoryStage, TeamPlan } from './types';

export const FLOOR = { w: 1200, h: 780 };

export const ROOMS: Room[] = [
  { id: 'reception', name: 'Reception', dept: 'Onboarding', color: '#e07a5f', x: 20, y: 20, w: 250, h: 200 },
  { id: 'product', name: 'Product Office', dept: 'Product', color: '#8b5cf6', x: 280, y: 20, w: 220, h: 200 },
  { id: 'architecture', name: 'Architecture Room', dept: 'Architecture', color: '#4f46e5', x: 510, y: 20, w: 220, h: 200 },
  { id: 'design', name: 'Design Studio', dept: 'Design', color: '#db2777', x: 740, y: 20, w: 210, h: 200 },
  { id: 'hr', name: 'HR & Staffing', dept: 'People', color: '#d97706', x: 960, y: 20, w: 220, h: 200 },
  { id: 'engineering', name: 'Engineering Floor', dept: 'Engineering', color: '#2563eb', x: 20, y: 250, w: 560, h: 260 },
  { id: 'war', name: 'Scrum War Room', dept: 'Delivery', color: '#0d9488', x: 590, y: 250, w: 290, h: 260 },
  { id: 'board', name: 'Boardroom', dept: 'Client', color: '#64748b', x: 890, y: 250, w: 290, h: 260 },
  { id: 'qa', name: 'QA Lab', dept: 'Quality', color: '#16a34a', x: 20, y: 540, w: 380, h: 220 },
  { id: 'perf', name: 'Performance Lab', dept: 'Performance', color: '#ea580c', x: 410, y: 540, w: 380, h: 220 },
  { id: 'server', name: 'Server Room', dept: 'DevOps', color: '#0891b2', x: 800, y: 540, w: 380, h: 220 },
];

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, Room>;

/** Rooms that count as departments (Reception and the client's Boardroom don't). */
export const DEPT_ROOMS = ROOMS.filter((r) => r.id !== 'reception' && r.id !== 'board');

export const ROLES: Record<Role, { label: string; room: RoomId }> = {
  client: { label: 'Client (You)', room: 'board' },
  pm: { label: 'Product Manager', room: 'product' },
  hr: { label: 'HR / Staffing', room: 'hr' },
  architect: { label: 'Solution Architect', room: 'architecture' },
  designer: { label: 'UI/UX Designer', room: 'design' },
  scrum: { label: 'Scrum Master', room: 'war' },
  lead: { label: 'Tech Lead', room: 'engineering' },
  fe: { label: 'Frontend Dev', room: 'engineering' },
  be: { label: 'Backend Dev', room: 'engineering' },
  fullstack: { label: 'Full-stack Dev', room: 'engineering' },
  mobile: { label: 'Mobile Dev', room: 'engineering' },
  devops: { label: 'DevOps Engineer', room: 'server' },
  qa: { label: 'QA Tester', room: 'qa' },
  perf: { label: 'Performance QA', room: 'perf' },
};

/** Day-one staff. Everyone else is hired for the project. */
export const FOUNDERS: { name: string; role: Role }[] = [
  { name: 'You', role: 'client' },
  { name: 'Rohan', role: 'pm' },
  { name: 'Neha', role: 'hr' },
];

/** Candidate names HR hires from, per role. */
export const TALENT: Partial<Record<Role, string[]>> = {
  architect: ['Meera'],
  designer: ['Kabir', 'Zoya'],
  scrum: ['Vikram'],
  lead: ['Isha'],
  fe: ['Sana', 'Kunal', 'Ira'],
  be: ['Aditya', 'Tara', 'Farhan'],
  fullstack: ['Riya', 'Omar', 'Lakshmi'],
  mobile: ['Nikhil', 'Ananya'],
  devops: ['Arjun'],
  qa: ['Priya', 'Manav'],
  perf: ['Dev'],
};

/** Rough tokens an agent in each role burns per tick of work. */
export const TOKENS_PER_TICK: Record<Role, number> = {
  client: 0,
  pm: 5_000,
  hr: 2_000,
  architect: 7_000,
  designer: 6_000,
  scrum: 3_000,
  lead: 6_000,
  fe: 9_000,
  be: 9_000,
  fullstack: 9_000,
  mobile: 9_000,
  devops: 4_000,
  qa: 5_000,
  perf: 6_000,
};

/** Blended $ per million tokens used for the estimate. Set it to your model's pricing. */
export const USD_PER_M_TOKENS = 6;

export const DEV_ROLES: Role[] = ['fe', 'be', 'fullstack', 'mobile'];

/** Which role works each stage of a story, and how long it takes (ticks). */
export const STORY_STAGES: Record<StoryStage, { role: Role | 'dev'; room: RoomId; work: [number, number]; label: string }> = {
  build: { role: 'dev', room: 'engineering', work: [10, 18], label: 'Build' },
  review: { role: 'lead', room: 'engineering', work: [3, 5], label: 'Code review' },
  qa: { role: 'qa', room: 'qa', work: [4, 7], label: 'QA test' },
  perf: { role: 'perf', room: 'perf', work: [5, 8], label: 'Load test' },
  deploy: { role: 'devops', room: 'server', work: [2, 4], label: 'Deploy' },
};

export const STORY_ORDER: StoryStage[] = ['build', 'review', 'qa', 'perf', 'deploy'];

const STORY_LIBRARY: (StoryPlan & { mobileOnly?: boolean; core?: boolean })[] = [
  { title: 'Sign-up & login', role: 'be', needsPerf: true, core: true },
  { title: 'Landing page', role: 'fe', needsPerf: false, core: true },
  { title: 'Home dashboard', role: 'fe', needsPerf: false, core: true },
  { title: 'Search & filters API', role: 'be', needsPerf: true, core: true },
  { title: 'Checkout flow', role: 'fe', needsPerf: false },
  { title: 'Payments integration', role: 'be', needsPerf: true },
  { title: 'Admin panel', role: 'fe', needsPerf: false },
  { title: 'Analytics events API', role: 'be', needsPerf: true },
  { title: 'Mobile app shell', role: 'mobile', needsPerf: false, mobileOnly: true },
  { title: 'Push notifications', role: 'mobile', needsPerf: true, mobileOnly: true },
];

/**
 * The Architect's staffing call: reads the brief and decides the team and scope.
 * Real agents will do this with an LLM; the simulation uses keyword cues.
 */
export function planTeam(brief: string): TeamPlan {
  const b = brief.toLowerCase();
  const small = /\b(mvp|simple|landing|prototype|small|poc)\b/.test(b);
  const mobile = /\b(mobile|android|ios|app store|play store)\b/.test(b);
  const scale = /\b(lakh|lakhs|million|crore|scale|traffic|concurrent)\b/.test(b);

  const team: TeamPlan['team'] = [
    { role: 'designer', count: 1, why: 'Wireframes, UI kit and user flows' },
    { role: 'scrum', count: 1, why: 'Sprint planning and daily reports' },
    { role: 'lead', count: 1, why: 'Code review and technical decisions' },
  ];
  if (small) team.push({ role: 'fullstack', count: 2, why: 'Small scope: one team owns UI and API' });
  else {
    team.push({ role: 'fe', count: 2, why: 'Web UI' });
    team.push({ role: 'be', count: 2, why: 'APIs, database, integrations' });
  }
  if (mobile) team.push({ role: 'mobile', count: 1, why: 'Android / iOS app' });
  team.push({ role: 'devops', count: 1, why: 'CI/CD, environments, deploys' });
  team.push({ role: 'qa', count: small ? 1 : 2, why: 'Functional testing against acceptance criteria' });
  team.push({
    role: 'perf',
    count: 1,
    why: scale ? 'Brief expects lakhs of users: load, spike and soak tests' : 'Baseline load test before go-live',
  });

  const stories = STORY_LIBRARY.filter((s) => (mobile || !s.mobileOnly) && (!small || s.core)).map((s) => ({
    title: s.title,
    role: small && (s.role === 'fe' || s.role === 'be') ? ('fullstack' as Role) : s.role,
    needsPerf: s.needsPerf,
  }));

  return { team, stories };
}

export interface DocSpec {
  title: string;
  /** Who hands the work over. Same as `role` means they write it themselves. */
  by: Role;
  role: Role;
  work: number;
  kind?: 'doc' | 'hire';
  hireRole?: Role;
  effect?: 'plan' | 'budget';
}

export interface PhaseDef {
  id: PhaseId;
  label: string;
  docs: DocSpec[];
  gate?: { n: number; title: string; summary: string };
  next: PhaseId;
}

export const PHASES: PhaseDef[] = [
  {
    id: 'intake',
    label: 'Client brief',
    docs: [{ title: 'Client brief', by: 'client', role: 'pm', work: 6 }],
    next: 'requirements',
  },
  {
    id: 'requirements',
    label: 'PRD + hire architect',
    docs: [
      { title: 'PRD', by: 'pm', role: 'pm', work: 10 },
      { title: 'Hire: Solution Architect', by: 'pm', role: 'hr', work: 4, kind: 'hire', hireRole: 'architect' },
    ],
    next: 'architecture',
  },
  {
    id: 'architecture',
    label: 'Architecture & team plan',
    docs: [
      { title: 'Workflow & system architecture', by: 'pm', role: 'architect', work: 12 },
      { title: 'Team plan (headcount)', by: 'pm', role: 'architect', work: 6, effect: 'plan' },
    ],
    next: 'hiring',
  },
  {
    id: 'hiring',
    label: 'Hiring',
    docs: [], // one hire task per seat in the Architect's team plan
    next: 'budget',
  },
  {
    id: 'budget',
    label: 'Token budget',
    docs: [{ title: 'Token budget estimate', by: 'architect', role: 'pm', work: 6, effect: 'budget' }],
    gate: {
      n: 1,
      title: 'Approve team & token budget',
      summary: 'The team is hired and the PM has estimated the tokens needed to build the product. Nobody starts work until you approve.',
    },
    next: 'planning',
  },
  {
    id: 'planning',
    label: 'Design & sprint plan',
    docs: [
      { title: 'Wireframes & UI kit', by: 'pm', role: 'designer', work: 12 },
      { title: 'Sprint backlog & acceptance criteria', by: 'pm', role: 'scrum', work: 10 },
      { title: 'Scalability review (1L / 10L users)', by: 'architect', role: 'perf', work: 8 },
      { title: 'CI/CD pipeline & environments', by: 'architect', role: 'devops', work: 8 },
    ],
    next: 'build',
  },
  {
    id: 'build',
    label: 'Build',
    docs: [], // stories from the Architect's plan, assigned by the Scrum Master
    gate: { n: 2, title: 'Sprint demo / UAT sign-off', summary: 'Every story is built, reviewed, tested and on the preview URL.' },
    next: 'release',
  },
  {
    id: 'release',
    label: 'Release',
    docs: [
      { title: 'Full load, spike & soak test', by: 'pm', role: 'perf', work: 12 },
      { title: 'Release runbook', by: 'pm', role: 'devops', work: 5 },
    ],
    gate: { n: 3, title: 'Go live to production', summary: 'Load test report is in. Approve to deploy to production.' },
    next: 'launch',
  },
  {
    id: 'launch',
    label: 'Launch',
    docs: [{ title: 'Production deploy', by: 'pm', role: 'devops', work: 5 }],
    next: 'shipped',
  },
];

export const PHASE_BY_ID = Object.fromEntries(PHASES.map((p) => [p.id, p])) as Record<PhaseId, PhaseDef | undefined>;

export const PHASE_LINE: { id: PhaseId; label: string }[] = [
  ...PHASES.map((p) => ({ id: p.id, label: p.label })),
  { id: 'shipped', label: 'Shipped' },
];
