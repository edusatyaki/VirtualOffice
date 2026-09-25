import { useEffect, useState, useSyncExternalStore } from 'react';
import { Floor } from './components/Floor';
import { Roster } from './components/Roster';
import { SidePanel } from './components/SidePanel';
import { PHASE_LINE } from './domain/office';
import { OfficeSim, TICKS_PER_DAY } from './sim/engine';

const sim = new OfficeSim();

export function App() {
  const state = useSyncExternalStore(sim.subscribe, sim.getState);
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, []);

  // Office hours run 9:00–18:00 across one simulated day.
  const minutes = Math.floor(((state.tick % TICKS_PER_DAY) / TICKS_PER_DAY) * 9 * 60);
  const clock = `${String(9 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const phase = PHASE_LINE.find((p) => p.id === state.phase);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <div className="brand-name">Virtual Office</div>
            <div className="muted small">{state.project ? state.project.name : 'No active project'}</div>
          </div>
        </div>
        <div className="clock">
          <span className="clock-day">Day {state.day}</span>
          <span className="clock-time">{clock}</span>
          <span className="pill">{phase ? phase.label : 'Waiting for a client'}</span>
          <span className="pill pill-sim" title="Agents are simulated. Real Claude agents plug into the same events.">
            Simulation
          </span>
        </div>
        <div className="controls">
          <button className="btn" onClick={() => sim.setPaused(!state.paused)}>
            {state.paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
          <button className="btn" disabled={!state.paused} onClick={() => sim.stepOnce()} title="Pause first, then advance one step at a time">
            Step ›
          </button>
          <div className="seg">
            {[0.5, 1, 2, 4].map((s) => (
              <button key={s} className={state.speed === s ? 'active' : ''} onClick={() => sim.setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={state.autoApprove} onChange={(e) => sim.setAutoApprove(e.target.checked)} />
            Auto-approve gates
          </label>
          <button
            className="btn"
            onClick={() => {
              setSelected(undefined);
              sim.reset();
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <main className="main">
        <div className="floor-wrap">
          <Floor state={state} selected={selected} onSelect={setSelected} />
        </div>
        <SidePanel state={state} sim={sim} selected={selected} />
      </main>

      <Roster state={state} selected={selected} onSelect={setSelected} />
    </div>
  );
}
