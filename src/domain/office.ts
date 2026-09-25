import type { PhaseId, Role, Room, RoomId, StoryStage } from './types';

export const FLOOR = { w: 1200, h: 780 };

export const ROOMS: Room[] = [
  { id: 'lounge', name: 'Client Lounge', dept: 'Client Services', color: '#e07a5f', x: 20, y: 20, w: 250, h: 200 },
  { id: 'product', name: 'Product Office', dept: 'Product', color: '#8b5cf6', x: 280, y: 20, w: 220, h: 200 },
  { id: 'architecture', name: 'Architecture Room', dept: 'Architecture', color: '#4f46e5', x: 510, y: 20, w: 220, h: 200 },
  { id: 'design', name: 'Design Studio', dept: 'Design', color: '#db2777', x: 740, y: 20, w: 210, h: 200 },
  { id: 'hr', name: 'HR & Staffing', dept: 'People', color: '#d97706', x: 960, y: 20, w: 220, h: 200 },
  { id: 'engineering', name: 'Engineering Floor', dept: 'Engineering', color: '#2563eb', x: 20, y: 250, w: 560, h: 260 },
  { id: 'war', name: 'Scrum War Room', dept: 'Delivery', color: '#0d9488', x: 590, y: 250, w: 290, h: 260 },
  { id: 'board', name: 'Boardroom', dept: 'Leadership', color: '#64748b', x: 890, y: 250, w: 290, h: 260 },
  { id: 'qa', name: 'QA Lab', dept: 'Quality', color: '#16a34a', x: 20, y: 540, w: 380, h: 220 },
  { id: 'perf', name: 'Performance Lab', dept: 'Performance', color: '#ea580c', x: 410, y: 540, w: 380, h: 220 },
  { id: 'server', name: 'Server Room', dept: 'DevOps', color: '#0891b2', x: 800, y: 540, w: 380, h: 220 },
];

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, Room>;

export const ROLES: Record<Role, { label: string; room: RoomId }> = {
  client: { label: 'Client (You)', room: 'board' },
  ba: { label: 'Business Analyst', room: 'lounge' },
  pm: { label: 'Product Manager', room: 'product' },
  architect: { label: 'Solution Architect', room: 'architecture' },
  designer: { label: 'UI/UX Designer', room: 'design' },
  hr: { label: 'HR / Staffing', room: 'hr' },
  scrum: { label: 'Scrum Master', room: 'war' },
  lead: { label: 'Tech Lead', room: 'engineering' },
  fe: { label: 'Frontend Dev', room: 'engineering' },
  be: { label: 'Backend Dev', room: 'engineering' },
  mobile: { label: 'Mobile Dev', room: 'engineering' },
  devops: { label: 'DevOps Engineer', room: 'server' },
  qa: { label: 'QA Tester', room: 'qa' },
  perf: { label: 'Performance QA', room: 'perf' },
};

/** The permanent staff every project starts with. Devs are hired per project by HR. */
export const CORE_STAFF: { name: string; role: Role }[] = [
  { name: 'You', role: 'client' },
  { name: 'Asha', role: 'ba' },
  { name: 'Rohan', role: 'pm' },
  { name: 'Meera', role: 'architect' },
  { name: 'Kabir', role: 'designer' },
  { name: 'Neha', role: 'hr' },
  { name: 'Vikram', role: 'scrum' },
  { name: 'Isha', role: 'lead' },
  { name: 'Arjun', role: 'devops' },
  { name: 'Priya', role: 'qa' },
  { name: 'Dev', role: 'perf' },
];

export const HIRE_POOL: { name: string; role: Role }[] = [
  { name: 'Sana', role: 'fe' },
  { name: 'Kunal', role: 'fe' },
  { name: 'Aditya', role: 'be' },
  { name: 'Tara', role: 'be' },
  { name: 'Nikhil', role: 'mobile' },
];

/** Which role works each stage of a story, and how long it takes (ticks). */
export const STORY_STAGES: Record<StoryStage, { role: Role | 'dev'; room: RoomId; work: [number, number]; label: string }> = {
  build: { role: 'dev', room: 'engineering', work: [10, 18], label: 'Build' },
  review: { role: 'lead', room: 'engineering', work: [3, 5], label: 'Code review' },
  qa: { role: 'qa', room: 'qa', work: [4, 7], label: 'QA test' },
  perf: { role: 'perf', room: 'perf', work: [5, 8], label: 'Load test' },
  deploy: { role: 'devops', room: 'server', work: [2, 4], label: 'Deploy' },
};

export const STORY_ORDER: StoryStage[] = ['build', 'review', 'qa', 'perf', 'deploy'];

export const STORY_TEMPLATES: { title: string; role: Role; needsPerf: boolean }[] = [
  { title: 'Sign-up & login', role: 'be', needsPerf: true },
  { title: 'Landing page', role: 'fe', needsPerf: false },
  { title: 'Home dashboard', role: 'fe', needsPerf: false },
  { title: 'Search & filters API', role: 'be', needsPerf: true },
  { title: 'Checkout flow', role: 'fe', needsPerf: false },
  { title: 'Payments integration', role: 'be', needsPerf: true },
  { title: 'Mobile app shell', role: 'mobile', needsPerf: false },
  { title: 'Push notifications', role: 'mobile', needsPerf: true },
  { title: 'Admin panel', role: 'fe', needsPerf: false },
  { title: 'Analytics events API', role: 'be', needsPerf: true },
];

export interface PhaseDef {
  id: PhaseId;
  label: string;
  /** Room new work for this phase is dispatched from. */
  origin: RoomId;
  docs: { title: string; role: Role; work: number }[];
  gate?: { n: number; title: string; summary: string };
  next: PhaseId;
}

export const PHASES: PhaseDef[] = [
  {
    id: 'intake',
    label: 'Intake',
    origin: 'lounge',
    docs: [{ title: 'Requirements brief', role: 'ba', work: 12 }],
    gate: { n: 1, title: 'Approve requirements brief', summary: 'BA has turned your idea into a brief with users, goals and scale targets.' },
    next: 'feasibility',
  },
  {
    id: 'feasibility',
    label: 'Feasibility',
    origin: 'board',
    docs: [
      { title: 'PRD', role: 'pm', work: 12 },
      { title: 'Effort & cost estimate', role: 'architect', work: 8 },
    ],
    gate: { n: 2, title: 'Go / No-Go decision', summary: 'PM and Architect say this is feasible. Approve to start design.' },
    next: 'design',
  },
  {
    id: 'design',
    label: 'Design',
    origin: 'board',
    docs: [
      { title: 'System architecture', role: 'architect', work: 14 },
      { title: 'Wireframes & user flows', role: 'designer', work: 14 },
      { title: 'Scalability review (1L / 10L users)', role: 'perf', work: 9 },
    ],
    gate: { n: 3, title: 'Approve design & scale targets', summary: 'Architecture, wireframes and performance targets are ready for sign-off.' },
    next: 'staffing',
  },
  {
    id: 'staffing',
    label: 'Staffing',
    origin: 'board',
    docs: [{ title: 'Team plan & hiring', role: 'hr', work: 8 }],
    next: 'planning',
  },
  {
    id: 'planning',
    label: 'Sprint planning',
    origin: 'board',
    docs: [
      { title: 'Product backlog', role: 'scrum', work: 10 },
      { title: 'Acceptance criteria', role: 'pm', work: 8 },
    ],
    gate: { n: 4, title: 'Approve sprint backlog', summary: 'Stories, estimates and acceptance criteria for the build are ready.' },
    next: 'build',
  },
  {
    id: 'build',
    label: 'Build',
    origin: 'war',
    docs: [],
    gate: { n: 5, title: 'Sprint demo / UAT sign-off', summary: 'Every story is built, reviewed, tested and on the preview URL.' },
    next: 'release',
  },
  {
    id: 'release',
    label: 'Release',
    origin: 'board',
    docs: [
      { title: 'Full load, spike & soak test', role: 'perf', work: 14 },
      { title: 'Release notes & runbook', role: 'devops', work: 6 },
    ],
    gate: { n: 6, title: 'Go live to production', summary: 'Load test report is in. Approve to deploy to production.' },
    next: 'launch',
  },
  {
    id: 'launch',
    label: 'Launch',
    origin: 'board',
    docs: [{ title: 'Production deploy', role: 'devops', work: 6 }],
    next: 'shipped',
  },
];

export const PHASE_BY_ID = Object.fromEntries(PHASES.map((p) => [p.id, p])) as Record<PhaseId, PhaseDef | undefined>;

export const PHASE_LINE: { id: PhaseId; label: string }[] = [
  ...PHASES.map((p) => ({ id: p.id, label: p.label })),
  { id: 'shipped', label: 'Shipped' },
];
