import { useState, useEffect } from 'react';

interface HeartbeatTimerProps {
  intervalSeconds: number;
  lastHeartbeat?: string;
}

export function HeartbeatTimer({ intervalSeconds, lastHeartbeat }: HeartbeatTimerProps) {
  const [remaining, setRemaining] = useState(intervalSeconds);

  useEffect(() => {
    const calcRemaining = () => {
      if (!lastHeartbeat) return intervalSeconds;
      const elapsed = Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000);
      return Math.max(0, intervalSeconds - (elapsed % intervalSeconds));
    };

    setRemaining(calcRemaining());
    const timer = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? intervalSeconds : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, lastHeartbeat]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Heartbeat</span>
      <span className="mc-font-inter text-sm font-mono text-gray-200 tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}
