import { useLayoutEffect, useRef, useState } from 'react';
import { portraitURL } from '../art/pixelPeople';
import { ROLES, ROOM_BY_ID } from '../domain/office';
import type { Agent, OfficeState, Role } from '../domain/types';

/** Who each role reports to, best first. Falls back up the chain while seats are unfilled. */
const MANAGERS: Record<Role, Role[]> = {
  client: [],
  pm: ['client'],
  hr: ['client'],
  architect: ['pm', 'client'],
  designer: ['pm', 'client'],
  scrum: ['pm', 'client'],
  lead: ['architect', 'pm', 'client'],
  fe: ['lead', 'architect', 'pm', 'client'],
  be: ['lead', 'architect', 'pm', 'client'],
  fullstack: ['lead', 'architect', 'pm', 'client'],
  mobile: ['lead', 'architect', 'pm', 'client'],
  devops: ['architect', 'pm', 'client'],
  qa: ['architect', 'pm', 'client'],
  perf: ['architect', 'pm', 'client'],
};

/** Sibling order: leadership first, then delivery, then individual contributors. */
const ROLE_ORDER: Role[] = ['client', 'pm', 'hr', 'architect', 'designer', 'scrum', 'lead', 'devops', 'qa', 'perf', 'fe', 'be', 'fullstack', 'mobile'];

const STATUS_TEXT = { idle: 'idle', working: 'working', walking: 'walking', meeting: 'in meeting' } as const;

interface OrgNode {
  key: string;
  role: Role;
  agent?: Agent;
  /** An unfilled seat from the Architect's team plan. */
  open?: { hiring: boolean };
  children: OrgNode[];
}

function buildTree(state: OfficeState): OrgNode | undefined {
  const nodes = new Map<string, OrgNode>();
  const firstOf = new Map<Role, OrgNode>();
  const ordered = [...state.agents].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.hiredDay - b.hiredDay);
  for (const a of ordered) {
    const n: OrgNode = { key: a.id, role: a.role, agent: a, children: [] };
    nodes.set(a.id, n);
    if (!firstOf.has(a.role)) firstOf.set(a.role, n);
  }
  const managerOf = (role: Role) => MANAGERS[role].map((r) => firstOf.get(r)).find(Boolean);

  for (const n of nodes.values()) {
    if (n.role === 'client') continue;
    managerOf(n.role)?.children.push(n);
  }

  // Seats the Architect planned that HR hasn't filled yet.
  const hiring = new Set(state.tasks.filter((t) => t.kind === 'hire' && !t.done && state.agents.some((a) => a.taskId === t.id)).map((t) => t.hireRole));
  for (const seat of state.plan?.team ?? []) {
    const hired = state.agents.filter((a) => a.role === seat.role).length;
    for (let i = hired; i < seat.count; i++) {
      const open: OrgNode = { key: `open-${seat.role}-${i}`, role: seat.role, open: { hiring: hiring.has(seat.role) }, children: [] };
      managerOf(seat.role)?.children.push(open);
    }
  }

  const sort = (n: OrgNode) => {
    n.children.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || Number(!!a.open) - Number(!!b.open));
    n.children.forEach(sort);
  };
  const root = firstOf.get('client');
  if (root) sort(root);
  return root;
}

export function OrgChart({
  state,
  selected,
  onSelect,
}: {
  state: OfficeState;
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  const root = buildTree(state);
  const [fit, setFit] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLUListElement>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const centerNext = useRef(false);

  // Scale the whole tree down (never up) so it fits the panel width.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const tree = treeRef.current;
    if (!box || !tree) return;
    const measure = () => {
      const w = tree.scrollWidth;
      const h = tree.scrollHeight;
      setSize({ w, h });
      setScale(fit ? Math.min(1, (box.clientWidth - 8) / w) : 1);
    };
    measure();
    centerNext.current = !fit;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(tree);
    return () => ro.disconnect();
  }, [fit]);
  // At 100%, open centred on the top of the tree once it has re-rendered full size.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || !centerNext.current || scale !== 1) return;
    centerNext.current = false;
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
  }, [scale, size.w]);

  const employees = state.agents.filter((a) => a.role !== 'client').length;
  const managers = root ? countManagers(root) : 0;
  const planned = (state.plan?.team ?? []).reduce((n, t) => n + t.count, 0);
  const hiredFromPlan = (state.plan?.team ?? []).reduce((n, t) => n + Math.min(t.count, state.agents.filter((a) => a.role === t.role).length), 0);

  return (
    <div className="org-wrap">
      <div className="org-head">
        <div>
          <h2>Organization</h2>
          <div className="muted small">
            {employees} employees · {managers} people managers
            {state.plan ? ` · ${planned - hiredFromPlan} open seats from the Architect's plan` : ''}
          </div>
        </div>
        <div className="org-tools">
          <div className="seg" role="group" aria-label="Zoom">
            <button className={fit ? 'active' : ''} onClick={() => setFit(true)}>
              Fit
            </button>
            <button className={!fit ? 'active' : ''} onClick={() => setFit(false)}>
              100%
            </button>
          </div>
        <div className="org-legend small">
          <span>
            <i className="legend-card" /> Employee
          </span>
          <span>
            <i className="legend-open" /> Open seat
          </span>
        </div>
        </div>
      </div>
      {!state.plan && (
        <div className="org-hint small">Brief the Product Manager. Once the Architect writes the team plan, every planned seat appears here and fills in as HR hires.</div>
      )}
      <div className="org-scroll" ref={scrollRef}>
        {/* the sizer reserves the scaled footprint so scrolling matches what you see */}
        <div className="org-sizer" style={{ width: size.w * scale, height: size.h * scale }}>
          {root && (
            <ul className="org" ref={treeRef} style={{ transform: `scale(${scale})` }}>
              <Branch node={root} selected={selected} onSelect={onSelect} />
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Branch({ node, selected, onSelect }: { node: OrgNode; selected?: string; onSelect: (id?: string) => void }) {
  // Three or more individual contributors under one manager stack vertically to keep the chart narrow.
  const stack = node.children.length >= 3 && node.children.every((c) => c.children.length === 0);
  return (
    <li>
      <Card node={node} selected={selected} onSelect={onSelect} />
      {node.children.length > 0 &&
        (stack ? (
          <div className="org-stack">
            {node.children.map((c) => (
              <Card key={c.key} node={c} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <ul>
            {node.children.map((c) => (
              <Branch key={c.key} node={c} selected={selected} onSelect={onSelect} />
            ))}
          </ul>
        ))}
    </li>
  );
}

function Card({ node, selected, onSelect }: { node: OrgNode; selected?: string; onSelect: (id?: string) => void }) {
  const accent = ROOM_BY_ID[ROLES[node.role].room].color;
  if (node.open) {
    return (
      <div className="org-card open">
        <span className="org-avatar open-avatar">?</span>
        <span className="org-text">
          <span className="org-name">Open seat</span>
          <span className="org-role">{ROLES[node.role].label}</span>
          <span className={`badge ${node.open.hiring ? 'badge-working' : 'badge-idle'}`}>
            <i />
            {node.open.hiring ? 'HR is hiring' : 'not started'}
          </span>
        </span>
      </div>
    );
  }
  const a = node.agent!;
  const reports = countReports(node);
  return (
    <button
      className={`org-card ${selected === a.id ? 'selected' : ''}`}
      style={{ ['--accent' as string]: accent }}
      onClick={() => onSelect(selected === a.id ? undefined : a.id)}
    >
      <span className="org-avatar" style={{ background: accent }}>
        <img src={portraitURL(a.name)} alt="" width={36} height={56} />
      </span>
      <span className="org-text">
        <span className="org-name">{a.name}</span>
        <span className="org-role">{ROLES[a.role].label}</span>
        <span className={`badge badge-${a.status}`}>
          <i />
          {STATUS_TEXT[a.status]}
        </span>
        {reports > 0 && (
          <span className="org-reports">
            {reports} report{reports === 1 ? '' : 's'}
          </span>
        )}
      </span>
    </button>
  );
}

/** People with at least one hired direct report. */
function countManagers(n: OrgNode): number {
  const self = n.agent && n.children.some((c) => c.agent) ? 1 : 0;
  return self + n.children.reduce((sum, c) => sum + countManagers(c), 0);
}

/** Everyone below this node, hired people only. */
function countReports(n: OrgNode): number {
  return n.children.reduce((sum, c) => sum + (c.agent ? 1 : 0) + countReports(c), 0);
}
