import { useEffect, useState } from 'react';
import { FLOOR, ROLES, ROOM_BY_ID, ROOMS } from '../domain/office';
import type { Agent, Flight, OfficeState, Room, RoomId, Task } from '../domain/types';

const CELL_W = 66;
const CELL_H = 64;
const PAD_X = 22;
const PAD_TOP = 64;

function grid(room: Room) {
  const cols = Math.max(1, Math.floor((room.w - PAD_X * 2) / CELL_W));
  const rows = Math.max(1, Math.floor((room.h - PAD_TOP - 30) / CELL_H));
  return { cols, rows };
}

function slot(room: Room, i: number) {
  const { cols } = grid(room);
  return {
    x: room.x + PAD_X + (i % cols) * CELL_W + CELL_W / 2,
    y: room.y + PAD_TOP + Math.floor(i / cols) * CELL_H + 18,
  };
}

function center(id: RoomId) {
  const r = ROOM_BY_ID[id];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Floor({
  state,
  selected,
  onSelect,
}: {
  state: OfficeState;
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  // Stable per-room ordering so avatars don't shuffle every tick.
  const byRoom = new Map<RoomId, Agent[]>();
  for (const a of [...state.agents].sort((a, b) => a.id.localeCompare(b.id))) {
    const list = byRoom.get(a.at) ?? [];
    list.push(a);
    byRoom.set(a.at, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const a of state.agents) {
    const list = byRoom.get(a.at) ?? [];
    positions.set(a.id, slot(ROOM_BY_ID[a.at], list.indexOf(a)));
  }

  const openTasks = state.tasks.filter((t) => !t.done && !t.inTransit && t.kind !== 'approval');
  const shipped = state.tasks.filter((t) => t.kind === 'story' && t.done).length;

  return (
    <svg className="floor" viewBox={`0 0 ${FLOOR.w} ${FLOOR.h}`} onClick={() => onSelect(undefined)}>
      <defs>
        <pattern id="tiles" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" className="tile-line" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={FLOOR.w} height={FLOOR.h} className="floor-bg" />
      <rect x="0" y="0" width={FLOOR.w} height={FLOOR.h} fill="url(#tiles)" />

      {ROOMS.map((room) => {
        const people = state.agents.filter((a) => a.at === room.id);
        const working = people.filter((a) => a.status === 'working').length;
        const tasks = openTasks.filter((t) => t.room === room.id);
        return (
          <RoomView
            key={room.id}
            room={room}
            headcount={people.length}
            working={working}
            tasks={tasks}
            shipped={room.id === 'server' ? shipped : undefined}
          />
        );
      })}

      {state.agents.map((a) => {
        const pos = positions.get(a.id)!;
        const task = a.taskId ? state.tasks.find((t) => t.id === a.taskId) : undefined;
        return (
          <AgentView
            key={a.id}
            agent={a}
            x={pos.x}
            y={pos.y}
            task={task}
            selected={selected === a.id}
            onSelect={onSelect}
          />
        );
      })}

      <FlightLayer flights={state.flights} positions={positions} />
    </svg>
  );
}

function RoomView({
  room,
  headcount,
  working,
  tasks,
  shipped,
}: {
  room: Room;
  headcount: number;
  working: number;
  tasks: Task[];
  shipped?: number;
}) {
  const { cols, rows } = grid(room);
  const desks = Array.from({ length: cols * rows }, (_, i) => slot(room, i));
  const shown = tasks.slice(0, 7);
  return (
    <g className="room">
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="10" className="room-fill" />
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="10" fill={room.color} opacity="0.07" />
      <rect x={room.x} y={room.y} width={room.w} height="5" rx="2" fill={room.color} />
      <text x={room.x + 14} y={room.y + 26} className="room-name">
        {room.name}
      </text>
      <text x={room.x + 14} y={room.y + 43} className="room-dept" fill={room.color}>
        {room.dept.toUpperCase()}
      </text>
      <g transform={`translate(${room.x + room.w - 14}, ${room.y + 16})`}>
        <Badge x={-54} label={`${headcount}`} icon="person" title={`${headcount} agents in this room`} />
        <Badge x={-24} label={`${tasks.length}`} icon="task" title={`${tasks.length} open tasks here`} />
      </g>
      {working > 0 && (
        <text x={room.x + room.w - 14} y={room.y + 50} textAnchor="end" className="room-working">
          {working} working
        </text>
      )}

      {desks.map((d, i) => (
        <g key={i} className="desk">
          <rect x={d.x - 20} y={d.y + 10} width="40" height="14" rx="3" />
          <rect x={d.x - 7} y={d.y + 12} width="14" height="6" rx="1" className="monitor" />
        </g>
      ))}

      {shown.map((t, i) => (
        <g key={t.id} transform={`translate(${room.x + room.w - 16 - i * 34}, ${room.y + room.h - 20})`}>
          <title>{`${t.id} · ${t.title}${t.stage ? ` · ${t.stage}` : ''}${t.rework ? ` · rework (${t.rework})` : ''}`}</title>
          <rect x="-30" y="-9" width="30" height="16" rx="3" className={`card card-${t.kind} ${t.rework ? 'card-rework' : ''}`} />
          <text x="-15" y="3" textAnchor="middle" className="card-text">
            {t.id.replace('T-', '#')}
          </text>
        </g>
      ))}
      {tasks.length > shown.length && (
        <text x={room.x + room.w - 18 - shown.length * 34} y={room.y + room.h - 16} textAnchor="end" className="room-more">
          +{tasks.length - shown.length}
        </text>
      )}
      {shipped !== undefined && shipped > 0 && (
        <text x={room.x + 14} y={room.y + room.h - 14} className="room-shipped">
          ✓ {shipped} shipped
        </text>
      )}
    </g>
  );
}

function Badge({ x, label, icon, title }: { x: number; label: string; icon: 'person' | 'task'; title: string }) {
  return (
    <g transform={`translate(${x}, 0)`} className="badge">
      <title>{title}</title>
      <rect x="-2" y="-2" width="28" height="18" rx="9" />
      {icon === 'person' ? (
        <g className="badge-icon">
          <circle cx="7" cy="4" r="2.6" />
          <path d="M2.5 12c0-3 2-4.4 4.5-4.4s4.5 1.4 4.5 4.4" />
        </g>
      ) : (
        <rect x="3" y="2" width="8" height="10" rx="1.5" className="badge-icon" />
      )}
      <text x="19" y="11" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function AgentView({
  agent,
  x,
  y,
  task,
  selected,
  onSelect,
}: {
  agent: Agent;
  x: number;
  y: number;
  task?: Task;
  selected: boolean;
  onSelect: (id?: string) => void;
}) {
  const color = ROOM_BY_ID[agent.home].color;
  const isClient = agent.role === 'client';
  return (
    <g
      className={`agent status-${agent.status} ${selected ? 'selected' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(agent.id);
      }}
    >
      <title>{`${agent.name} · ${ROLES[agent.role].label} · ${agent.status}${task ? ` · ${task.title}` : ''}`}</title>
      <g className="agent-body">
        {agent.status === 'working' && <circle r="19" className="ring" stroke={color} />}
        {selected && <circle r="21" className="select-ring" />}
        <ellipse cx="0" cy="8" rx="13" ry="9" fill={color} />
        <circle cx="0" cy="-6" r="9" className="head" />
        <text y="-3" textAnchor="middle" className="initials">
          {isClient ? '★' : initials(agent.name)}
        </text>
        {agent.status === 'meeting' && <circle cx="11" cy="-12" r="4" className="dot-meeting" />}
        {agent.status === 'idle' && <circle cx="11" cy="-12" r="3.5" className="dot-idle" />}
      </g>
      {task && agent.status === 'working' && (
        <g transform="translate(-16, -24)">
          <rect width="32" height="4" rx="2" className="bar-bg" />
          <rect width={32 * task.progress} height="4" rx="2" fill={color} />
        </g>
      )}
      <text y="30" textAnchor="middle" className="agent-name">
        {agent.name}
      </text>
    </g>
  );
}

function FlightLayer({ flights, positions }: { flights: Flight[]; positions: Map<string, { x: number; y: number }> }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!flights.length) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flights.length]);

  return (
    <g className="flights">
      {flights.map((f) => {
        if (now < f.startWall) return null; // staggered hand-offs wait their turn
        const a = (f.fromAgent && positions.get(f.fromAgent)) || center(f.from);
        const b = (f.toAgent && positions.get(f.toAgent)) || center(f.to);
        const lift = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
        const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift };
        const t = Math.min(1, (now - f.startWall) / f.durationMs);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const px = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x;
        const py = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y;
        return (
          <g key={f.id}>
            <path d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`} className={`flight-path flight-${f.kind}`} />
            <g transform={`translate(${px}, ${py})`} className={`flight-token flight-${f.kind}`}>
              <rect x="-26" y="-11" width="52" height="22" rx="6" />
              <text y="4" textAnchor="middle">
                {f.label.replace('T-', '#')}
              </text>
              <text y="25" textAnchor="middle" className="flight-caption">
                {f.caption}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
