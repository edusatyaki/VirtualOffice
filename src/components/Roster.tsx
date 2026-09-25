import { ROLES, ROOM_BY_ID } from '../domain/office';
import type { OfficeState } from '../domain/types';
import { fmtTokens } from '../sim/engine';

export function Roster({
  state,
  selected,
  onSelect,
}: {
  state: OfficeState;
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  return (
    <div className="roster">
      {state.agents.map((a) => {
        const task = a.taskId ? state.tasks.find((t) => t.id === a.taskId) : undefined;
        return (
          <button
            key={a.id}
            className={`roster-card ${selected === a.id ? 'selected' : ''}`}
            onClick={() => onSelect(selected === a.id ? undefined : a.id)}
          >
            <span className="swatch" style={{ background: ROOM_BY_ID[a.home].color }} />
            <span className="roster-text">
              <strong>{a.name}</strong>
              <span className="muted">
                {ROLES[a.role].label}
                {a.tokensUsed > 0 && ` · ${fmtTokens(a.tokensUsed)} tok`}
              </span>
              <span className={`status status-${a.status}`}>{task ? `${a.status} · ${task.title}` : a.status}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
