import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Floor } from './components/Floor';
import { Roster } from './components/Roster';
import { SidePanel } from './components/SidePanel';
import { PHASE_LINE } from './domain/office';
import type { OfficeState } from './domain/types';
import { OfficeSim, TICKS_PER_DAY } from './sim/engine';
import { useFullscreen } from './useFullscreen';

const sim = new OfficeSim();

function Playback({ state }: { state: OfficeState }) {
  return (
    <>
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
    </>
  );
}

export function App() {
  const state = useSyncExternalStore(sim.subscribe, sim.getState);
  const [selected, setSelected] = useState<string>();
  const floorRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(floorRef);

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, []);

  // F toggles full screen, unless you're typing in the brief form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'f') fs.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

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
          <Playback state={state} />
          <label className="toggle">
            <input type="checkbox" checked={state.autoApprove} onChange={(e) => sim.setAutoApprove(e.target.checked)} />
            Auto-approve gates
          </label>
          <button className="btn" onClick={fs.enter} title="Full screen (F)">
            ⛶ Full screen
          </button>
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
        <div ref={floorRef} className={`floor-wrap ${fs.active ? 'is-full' : ''} ${fs.fallback ? 'is-full-fallback' : ''}`}>
          <Floor state={state} selected={selected} onSelect={setSelected} />
          {fs.active && (
            <div className="fs-overlay">
              <div className="fs-bar">
                <span className="fs-title">
                  <strong>{state.project?.name ?? 'Virtual Office'}</strong>
                  <span className="muted">
                    Day {state.day} · {clock}
                  </span>
                  <span className="pill">{phase ? phase.label : 'Waiting for a client'}</span>
                </span>
                <span className="fs-controls">
                  <Playback state={state} />
                  <button className="btn primary" onClick={fs.exit} title="Exit full screen (Esc)">
                    Exit full screen
                  </button>
                </span>
              </div>
              {state.phase === 'idle' && (
                <div className="fs-card">
                  <div className="approval-kicker">No project yet</div>
                  <p>Exit full screen and brief the Product Manager to start the office.</p>
                </div>
              )}
              {state.approvals.map((ap) => (
                <div className="fs-card approval" key={ap.id}>
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
            </div>
          )}
        </div>
        <SidePanel state={state} sim={sim} selected={selected} />
      </main>

      <Roster state={state} selected={selected} onSelect={setSelected} />
    </div>
  );
}
