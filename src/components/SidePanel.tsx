import { useState } from 'react';
import { DEPT_ROOMS, PHASE_LINE, ROLES, ROOM_BY_ID, STORY_STAGES } from '../domain/office';
import type { Approval, OfficeState, StatusReport, StoryStage, Task } from '../domain/types';
import { portraitURL } from '../art/pixelPeople';
import { fmtTokens, type OfficeSim } from '../sim/engine';

type Tab = 'overview' | 'handoffs' | 'tasks' | 'activity' | 'reports';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'handoffs', label: 'Handoffs' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'activity', label: 'Activity' },
  { id: 'reports', label: 'Reports' },
];

export function SidePanel({ state, sim, selected }: { state: OfficeState; sim: OfficeSim; selected?: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const agent = selected ? state.agents.find((a) => a.id === selected) : undefined;

  return (
    <aside className="panel">
      {state.phase === 'idle' && <BriefForm sim={sim} />}

      {state.approvals.map((ap) => (
        <ApprovalCard key={ap.id} ap={ap} state={state} sim={sim} />
      ))}

      {agent && (
        <div className="agent-card">
          <div className="agent-card-head">
            <span className="portrait" style={{ background: ROOM_BY_ID[agent.home].color }}>
              <img src={portraitURL(agent.name)} alt="" width={36} height={56} />
            </span>
            <div>
              <div className="roster-name">{agent.name}</div>
              <div className="muted">{ROLES[agent.role].label}</div>
            </div>
          </div>
          <div className="muted small">
            {agent.status} · in {ROOM_BY_ID[agent.at].name} · {agent.tasksDone} tasks done · {fmtTokens(agent.tokensUsed)} tokens ·
            joined day {agent.hiredDay}
          </div>
          {agent.taskId && <div className="small">Working on {state.tasks.find((t) => t.id === agent.taskId)?.title}</div>}
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.id === 'reports' ? `${t.label} (${state.reports.length})` : t.label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'overview' && <Overview state={state} />}
        {tab === 'handoffs' && <Handoffs state={state} />}
        {tab === 'tasks' && <Tasks state={state} />}
        {tab === 'activity' && <Activity state={state} />}
        {tab === 'reports' && <Reports state={state} sim={sim} />}
      </div>
    </aside>
  );
}

function ApprovalCard({ ap, state, sim }: { ap: Approval; state: OfficeState; sim: OfficeSim }) {
  const budget = ap.gate === 1 ? state.budget : undefined;
  return (
    <div className="approval">
      <div className="approval-kicker">Gate {ap.gate} · needs you</div>
      <div className="approval-title">{ap.title}</div>
      <p>{ap.summary}</p>
      {budget && (
        <table className="budget-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>People</th>
              <th>Tasks</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((l) => (
              <tr key={l.role}>
                <td>{ROLES[l.role].label}</td>
                <td>{l.headcount}</td>
                <td>{l.tasks}</td>
                <td>{fmtTokens(l.tokens)}</td>
              </tr>
            ))}
            <tr className="sub">
              <td colSpan={3}>Rework buffer (20%)</td>
              <td>{fmtTokens(budget.buffer)}</td>
            </tr>
            <tr className="total">
              <td colSpan={3}>Total · ≈ ${budget.usd.toFixed(2)}</td>
              <td>{fmtTokens(budget.total)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="row">
        <button className="btn primary" onClick={() => sim.approve(ap.id)}>
          Approve
        </button>
        <button className="btn" onClick={() => sim.requestChanges(ap.id)}>
          Request changes
        </button>
      </div>
    </div>
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
      <div className="muted small">
        Rohan (PM) takes the brief, gets an Architect hired, and the Architect decides the team. Try words like “mobile”, “MVP” or “10 lakh
        users” to change who gets hired.
      </div>
      <button className="btn primary" type="submit">
        Brief the Product Manager
      </button>
    </form>
  );
}

function Overview({ state }: { state: OfficeState }) {
  const current = PHASE_LINE.findIndex((p) => p.id === state.phase);
  const depts = DEPT_ROOMS.map((r) => {
    const staff = state.agents.filter((a) => a.home === r.id);
    return { room: r, count: staff.length, working: staff.filter((a) => a.status === 'working').length };
  });
  const max = Math.max(...depts.map((d) => d.count), 1);
  const stories = state.tasks.filter((t) => t.kind === 'story');
  const stageCount = (s: StoryStage) => stories.filter((t) => !t.done && t.stage === s).length;
  const budget = state.budget;
  const pct = budget ? state.tokensUsed / budget.total : 0;

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
        <h3>Token budget</h3>
        {budget ? (
          <>
            <div className="meter">
              <span className={`meter-fill ${pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : ''}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
            </div>
            <div className="small">
              <strong>{fmtTokens(state.tokensUsed)}</strong> used of {fmtTokens(budget.total)} approved ({Math.round(pct * 100)}%) · ≈ $
              {budget.usd.toFixed(2)} budget
            </div>
          </>
        ) : (
          <div className="small muted">
            {fmtTokens(state.tokensUsed)} tokens used so far. The PM estimates the budget once the team is hired.
          </div>
        )}
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
          {state.flights.length} hand-off{state.flights.length === 1 ? '' : 's'} in flight
        </div>
      </section>

      {state.plan && (
        <section>
          <h3>Architect's team plan</h3>
          <ul className="plan">
            {state.plan.team.map((t) => {
              const hired = state.agents.filter((a) => a.role === t.role).length;
              return (
                <li key={t.role}>
                  <span className="swatch" style={{ background: ROOM_BY_ID[ROLES[t.role].room].color }} />
                  <span className="plan-role">
                    {t.count} × {ROLES[t.role].label}
                  </span>
                  <span className={`pill ${hired >= t.count ? 'pill-done' : ''}`}>
                    {hired}/{t.count} hired
                  </span>
                  <span className="muted small plan-why">{t.why}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3>Delivery pipeline</h3>
        {stories.length === 0 ? (
          <div className="muted small">Stories appear here once the Scrum Master assigns them.</div>
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

function Handoffs({ state }: { state: OfficeState }) {
  const list = state.handoffs.slice().reverse();
  if (!list.length) return <div className="muted small">Every time one agent passes work to another, it shows up here.</div>;
  return (
    <ol className="handoffs">
      {list.map((h, i) => (
        <li key={h.id}>
          <span className="handoff-n">{list.length - i}</span>
          <div>
            <div className="handoff-who">
              <strong>{h.fromName}</strong>
              <span className="arrow">→</span>
              <strong>{h.toName}</strong>
              <span className="muted small">D{h.day}</span>
            </div>
            <div className="small">
              {h.taskId.replace('T-', '#')} {h.title}
            </div>
            <div className="trail">
              <RoomChip id={h.fromRoom} />
              <span className="muted small">→</span>
              <RoomChip id={h.toRoom} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RoomChip({ id }: { id: Task['room'] }) {
  const r = ROOM_BY_ID[id];
  return (
    <span className="trail-chip">
      <i style={{ background: r.color }} />
      {r.name}
    </span>
  );
}

function Tasks({ state }: { state: OfficeState }) {
  const tasks = state.tasks.filter((t) => t.kind !== 'approval').slice().reverse();
  if (!tasks.length) return <div className="muted small">No work yet. Brief the Product Manager to start.</div>;
  return (
    <ul className="task-list">
      {tasks.map((t) => {
        const who = t.owner ? state.agents.find((a) => a.id === t.owner) : undefined;
        const by = t.by ? state.agents.find((a) => a.id === t.by) : undefined;
        const status = t.done
          ? 'done'
          : t.inTransit
            ? 'moving'
            : t.rework
              ? `rework: ${t.rework}`
              : t.stage
                ? STORY_STAGES[t.stage].label
                : t.kind === 'hire'
                  ? 'hiring'
                  : 'doc';
        return (
          <li key={t.id} className={t.done ? 'is-done' : ''}>
            <div className="task-head">
              <span className="task-id">{t.id.replace('T-', '#')}</span>
              <span className="task-title">{t.title}</span>
              <span className={`pill ${t.done ? 'pill-done' : t.rework ? 'pill-warn' : ''}`}>{status}</span>
            </div>
            <div className="muted small">
              {t.inTransit ? 'In transit' : ROOM_BY_ID[t.room].name}
              {who && ` · owner ${who.name}`}
              {by && ` · from ${by.name}`}
              {t.bugs > 0 && ` · ${t.bugs} bug${t.bugs > 1 ? 's' : ''}`}
              {t.perfIssues > 0 && ` · ${t.perfIssues} perf fix${t.perfIssues > 1 ? 'es' : ''}`}
            </div>
            <div className="trail">
              {t.trail.map((r, i) => (
                <RoomChip key={i} id={r} />
              ))}
            </div>
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
        Ask for a status report
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
      <div className="small">
        Tokens: {fmtTokens(r.tokens.used)}
        {r.tokens.budget ? ` of ${fmtTokens(r.tokens.budget)} approved (${Math.round((r.tokens.used / r.tokens.budget) * 100)}%)` : ' (no budget yet)'}
      </div>
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
        Team:{' '}
        {r.headcount
          .filter((h) => h.count)
          .map((h) => `${h.dept} ${h.count}`)
          .join(' · ')}
      </div>
    </article>
  );
}
