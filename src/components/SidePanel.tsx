import { useState } from 'react';
import { PHASE_LINE, ROLES, ROOM_BY_ID, ROOMS, STORY_STAGES } from '../domain/office';
import type { OfficeState, StatusReport, StoryStage, Task } from '../domain/types';
import type { OfficeSim } from '../sim/engine';

type Tab = 'overview' | 'tasks' | 'activity' | 'reports';

export function SidePanel({ state, sim, selected }: { state: OfficeState; sim: OfficeSim; selected?: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const agent = selected ? state.agents.find((a) => a.id === selected) : undefined;

  return (
    <aside className="panel">
      {state.phase === 'idle' && <BriefForm sim={sim} />}

      {state.approvals.map((ap) => (
        <div className="approval" key={ap.id}>
          <div className="approval-kicker">Gate {ap.gate} · needs you</div>
          <div className="approval-title">{ap.title}</div>
          <p>{ap.summary}</p>
          <div className="row">
            <button className="btn primary" onClick={() => sim.approve(ap.id)}>
              Approve
            </button>
            <button className="btn" onClick={() => sim.requestChanges(ap.id)}>
              Request changes
            </button>
          </div>
        </div>
      ))}

      {agent && (
        <div className="agent-card">
          <div className="agent-card-head">
            <span className="swatch" style={{ background: ROOM_BY_ID[agent.home].color }} />
            <strong>{agent.name}</strong>
            <span className="muted">{ROLES[agent.role].label}</span>
          </div>
          <div className="muted small">
            {agent.status} · in {ROOM_BY_ID[agent.at].name} · {agent.tasksDone} tasks done · joined day {agent.hiredDay}
          </div>
          {agent.taskId && (
            <div className="small">Working on {state.tasks.find((t) => t.id === agent.taskId)?.title}</div>
          )}
        </div>
      )}

      <nav className="tabs">
        {(['overview', 'tasks', 'activity', 'reports'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'reports' ? `Reports (${state.reports.length})` : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'overview' && <Overview state={state} />}
        {tab === 'tasks' && <Tasks state={state} />}
        {tab === 'activity' && <Activity state={state} />}
        {tab === 'reports' && <Reports state={state} sim={sim} />}
      </div>
    </aside>
  );
}

function BriefForm({ sim }: { sim: OfficeSim }) {
  const [name, setName] = useState('Campus food delivery app');
  const [brief, setBrief] = useState(
    'Students order food from campus canteens and get it delivered to their hostel. Web + mobile, payments, live order tracking. Expect 1 lakh users in year one.',
  );
  return (
    <form
      className="brief"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) sim.submitBrief(name.trim(), brief.trim());
      }}
    >
      <div className="approval-kicker">New client brief</div>
      <label>
        Project name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Your idea
        <textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
      </label>
      <button className="btn primary" type="submit">
        Brief the team
      </button>
    </form>
  );
}

function Overview({ state }: { state: OfficeState }) {
  const current = PHASE_LINE.findIndex((p) => p.id === state.phase);
  const depts = ROOMS.filter((r) => r.id !== 'board').map((r) => {
    const staff = state.agents.filter((a) => a.home === r.id);
    return {
      room: r,
      count: staff.length,
      working: staff.filter((a) => a.status === 'working').length,
    };
  });
  const max = Math.max(...depts.map((d) => d.count), 1);
  const stories = state.tasks.filter((t) => t.kind === 'story');
  const stageCount = (s: StoryStage) => stories.filter((t) => !t.done && t.stage === s).length;

  return (
    <div className="stack">
      <section>
        <h3>Project phase</h3>
        <ol className="phases">
          {PHASE_LINE.map((p, i) => (
            <li key={p.id} className={i < current ? 'done' : i === current ? 'current' : ''}>
              {p.label}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>Headcount by department</h3>
        <div className="bars">
          {depts.map((d) => (
            <div className="bar-row" key={d.room.id}>
              <span className="bar-label">{d.room.dept}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: d.room.color }} />
              </span>
              <span className="bar-value">
                {d.count}
                {d.working > 0 && <em> · {d.working} busy</em>}
              </span>
            </div>
          ))}
        </div>
        <div className="muted small">
          {state.agents.length - 1} agents employed · {state.agents.filter((a) => a.status === 'working').length} working now ·{' '}
          {state.flights.length} task{state.flights.length === 1 ? '' : 's'} moving between rooms
        </div>
      </section>

      <section>
        <h3>Delivery pipeline</h3>
        {stories.length === 0 ? (
          <div className="muted small">Stories appear here once the backlog is approved.</div>
        ) : (
          <>
            <div className="pipeline">
              {(Object.keys(STORY_STAGES) as StoryStage[]).map((s) => (
                <div key={s} className="stage">
                  <span className="stage-n">{stageCount(s)}</span>
                  <span className="stage-l">{STORY_STAGES[s].label}</span>
                </div>
              ))}
              <div className="stage stage-done">
                <span className="stage-n">{stories.filter((t) => t.done).length}</span>
                <span className="stage-l">Shipped</span>
              </div>
            </div>
            <div className="muted small">
              {stories.reduce((n, t) => n + t.bugs, 0)} bug(s) caught by QA · {stories.reduce((n, t) => n + t.perfIssues, 0)} performance
              issue(s) caught by Performance QA
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Trail({ t }: { t: Task }) {
  return (
    <div className="trail">
      {t.trail.map((r, i) => (
        <span key={i} className="trail-chip" style={{ borderColor: ROOM_BY_ID[r].color, color: ROOM_BY_ID[r].color }}>
          {ROOM_BY_ID[r].name.split(' ')[0]}
        </span>
      ))}
    </div>
  );
}

function Tasks({ state }: { state: OfficeState }) {
  const tasks = state.tasks.filter((t) => t.kind !== 'approval').slice().reverse();
  if (!tasks.length) return <div className="muted small">No work yet. Brief the team to start.</div>;
  return (
    <ul className="task-list">
      {tasks.map((t) => {
        const who = t.assignee ? state.agents.find((a) => a.id === t.assignee) : undefined;
        return (
          <li key={t.id} className={t.done ? 'is-done' : ''}>
            <div className="task-head">
              <span className="task-id">{t.id.replace('T-', '#')}</span>
              <span className="task-title">{t.title}</span>
              <span className={`pill ${t.done ? 'pill-done' : t.rework ? 'pill-warn' : ''}`}>
                {t.done ? 'done' : t.inTransit ? 'moving' : t.rework ? `rework: ${t.rework}` : t.stage ? STORY_STAGES[t.stage].label : 'doc'}
              </span>
            </div>
            <div className="muted small">
              {t.inTransit ? 'In transit' : ROOM_BY_ID[t.room].name}
              {who && ` · ${who.name}`}
              {t.bugs > 0 && ` · ${t.bugs} bug${t.bugs > 1 ? 's' : ''}`}
              {t.perfIssues > 0 && ` · ${t.perfIssues} perf fix${t.perfIssues > 1 ? 'es' : ''}`}
            </div>
            <Trail t={t} />
          </li>
        );
      })}
    </ul>
  );
}

function Activity({ state }: { state: OfficeState }) {
  const log = state.log.slice().reverse();
  if (!log.length) return <div className="muted small">The office is quiet.</div>;
  return (
    <ul className="log">
      {log.map((l) => (
        <li key={l.id} className={`tone-${l.tone}`}>
          <span className="log-dot" style={{ background: l.room ? ROOM_BY_ID[l.room].color : undefined }} />
          <span className="log-time">D{l.day}</span>
          <span>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Reports({ state, sim }: { state: OfficeState; sim: OfficeSim }) {
  const reports = state.reports.slice().reverse();
  return (
    <div className="stack">
      <button className="btn primary" disabled={state.phase === 'idle'} onClick={() => sim.requestReport()}>
        Ask the Scrum Master for status
      </button>
      <div className="muted small">A report is also filed automatically at the end of every working day.</div>
      {reports.map((r) => (
        <ReportCard key={r.id} r={r} />
      ))}
    </div>
  );
}

function ReportCard({ r }: { r: StatusReport }) {
  return (
    <article className="report">
      <div className="approval-kicker">
        Day {r.day} · {PHASE_LINE.find((p) => p.id === r.phase)?.label ?? r.phase}
      </div>
      <div className="report-headline">{r.headline}</div>
      {r.stories.total > 0 && (
        <div className="small">
          Stories: {r.stories.done}/{r.stories.total} done · build {r.stories.byStage.build} · review {r.stories.byStage.review} · QA{' '}
          {r.stories.byStage.qa} · load test {r.stories.byStage.perf} · deploy {r.stories.byStage.deploy}
          <br />
          Quality: {r.bugsFound} bug{r.bugsFound === 1 ? '' : 's'} found · {r.perfIssues} performance issue{r.perfIssues === 1 ? '' : 's'} found
        </div>
      )}
      {r.blockers.length > 0 && (
        <>
          <h4>Blockers</h4>
          <ul>
            {r.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </>
      )}
      {r.next.length > 0 && (
        <>
          <h4>Next</h4>
          <ul>
            {r.next.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </>
      )}
      <div className="muted small">
        Team: {r.headcount.filter((h) => h.count).map((h) => `${h.dept} ${h.count}`).join(' · ')}
      </div>
    </article>
  );
}
