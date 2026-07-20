import React from 'react';

type SunMeterProps = {
  demoMode: boolean;
  onePlayerMode: boolean;
  playerId: string;
  sun: Record<string, number>;
  wave: number;
  waveStatus: string;
  totalWaves: number;
};

// Session IDs are long UUIDs meant for the wire, not for a human to read.
// Shorten them for display until real display names exist.
function shortId(id: string) {
  return id ? id.slice(0, 8) : '';
}

function waveStatusLabel(waveStatus: string, wave: number, totalWaves: number) {
  if (waveStatus === 'pending') return 'Get ready...';
  if (waveStatus === 'break') return `Wave ${wave} cleared — next wave incoming...`;
  if (waveStatus === 'complete') return 'All waves cleared!';
  if (totalWaves > 0) return `Wave ${wave} / ${totalWaves}`;
  return `Wave ${wave}`;
}

export default function SunMeter({ demoMode, onePlayerMode, playerId, sun, wave, waveStatus, totalWaves }: SunMeterProps) {
  const sunEntries = Object.entries(sun);

  return (
    <div className="sun-meter">
      <span className={`mode-badge ${demoMode ? 'mode-badge--demo' : onePlayerMode ? 'mode-badge--solo' : 'mode-badge--live'}`}>
        {demoMode ? 'DEMO' : onePlayerMode ? 'SOLO' : 'LIVE'}
      </span>
      <span className="hud-line hud-line--wave">{waveStatusLabel(waveStatus, wave, totalWaves)}</span>
      {sunEntries.length > 0 ? (
        sunEntries.map(([id, value]) => (
          <span className="hud-line" key={id}>
            {id === playerId ? 'You' : `Teammate (${shortId(id)})`}: {value} sun
          </span>
        ))
      ) : (
        <span className="hud-line">No sun data yet</span>
      )}
    </div>
  );
}
