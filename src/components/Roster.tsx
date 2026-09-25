import { portraitURL } from '../art/pixelPeople';
import { ROLES, ROOM_BY_ID } from '../domain/office';
import type { OfficeState } from '../domain/types';
import { fmtTokens } from '../sim/engine';

const STATUS_TEXT = { idle: 'idle', working: 'working', walking: 'walking', meeting: 'in meeting' } as const;

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
        const accent = ROOM_BY_ID[a.home].color;
        return (
          <button
            key={a.id}
            className={`roster-card ${selected === a.id ? 'selected' : ''}`}
            style={{ ['--accent' as string]: accent }}
            onClick={() => onSelect(selected === a.id ? undefined : a.id)}
          >
            <span className="portrait" style={{ background: accent }}>
              <img src={portraitURL(a.name)} alt="" width={36} height={56} />
            </span>
            <span className="roster-text">
              <span className="roster-name">{a.name}</span>
              <span className="roster-role">
                {ROLES[a.role].label}
                {a.tokensUsed > 0 && ` · ${fmtTokens(a.tokensUsed)}`}
              </span>
              <span className={`badge badge-${a.status}`}>
                <i />
                {STATUS_TEXT[a.status]}
              </span>
              <span className="roster-task">{task ? task.title : ' '}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
