import React, { useEffect, useRef, useState } from 'react';
import { turns, callMeta, Turn } from '../../demo-data';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ToastProvider, useToast } from '../ui/toast';

interface EventLog {
  time: string;
  rule: string;
  severity: 'minor' | 'major';
  suggestedAction: string;
}

function composite(turn: Turn) {
  const asr = turn.confidence * 100;
  const keyword = turn.keywordMatchScore * 100;
  const flow = 100; // simple placeholder
  let base = 0.5 * asr + 0.4 * keyword + 0.1 * flow;
  if (turn.critical && turn.keywordMatchScore < 0.5) base -= 15;
  if (turn.critical && turn.confidence < 0.6) base -= 10;
  base = Math.max(0, Math.min(100, Math.round(base)));
  const label = base >= 80 ? 'ok' : base >= 60 ? 'warn' : 'critical';
  return { score: base, label };
}

function overallRisk(avg: number, events: EventLog[]): 'ok' | 'warn' | 'critical' {
  const recentMajor = events.some((e) => e.severity === 'major');
  const recentMinor = events.some((e) => e.severity === 'minor');
  if (avg < 65 || recentMajor) return 'critical';
  if (avg < 80 || recentMinor) return 'warn';
  return 'ok';
}

function riskColor(label: string) {
  return label === 'ok'
    ? 'var(--risk-ok)'
    : label === 'warn'
    ? 'var(--risk-warn)'
    : 'var(--risk-critical)';
}

function riskStyles(label: string) {
  return label === 'ok'
    ? { backgroundColor: 'var(--risk-ok-bg)', color: 'var(--risk-ok)' }
    : label === 'warn'
    ? { backgroundColor: 'var(--risk-warn-bg)', color: 'var(--risk-warn)' }
    : { backgroundColor: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' };
}

function DemoInner() {
  const [displayed, setDisplayed] = useState<Turn[]>([]);
  const [index, setIndex] = useState(0);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const toast = useToast();
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setIndex((i) => {
        if (i >= turns.length) return i;
        const t = turns[i];
        const { score, label } = composite(t);
        (t as any).compositeScore = score;
        (t as any).label = label;
        setScores((s) => [...s, score].slice(-8));
        setDisplayed((d) => [...d, t]);
        // events
        if (t.ruleTriggered.includes('missing_disclosure')) {
          setEvents((e) => [
            ...e,
            {
              time: t.timestamp,
              rule: 'missing_disclosure',
              severity: 'major',
              suggestedAction: 'Escalate',
            },
          ]);
        }
        if (t.ruleTriggered.includes('missing_consent')) {
          setEvents((e) => [
            ...e,
            {
              time: t.timestamp,
              rule: 'missing_consent',
              severity: 'major',
              suggestedAction: 'Escalate',
            },
          ]);
        }
        if (t.ruleTriggered.includes('late_call')) {
          setEvents((e) => [
            ...e,
            {
              time: t.timestamp,
              rule: 'late_call',
              severity: 'minor',
              suggestedAction: 'QA flag',
            },
          ]);
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [displayed]);

  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const oRisk = overallRisk(avg, events);

  const riskGaugeColor = riskColor(oRisk);

  const toggleRun = () => setRunning((r) => !r);

  const handleAction = (msg: string) => {
    toast(msg);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-center justify-between border-b pb-2">
        <div>
          <h1 className="text-lg font-semibold">{callMeta.callId}</h1>
          <p className="text-sm text-gray-600">
            {callMeta.customerName} • Elapsed {`${Math.floor(elapsed / 60)
              .toString()
              .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: riskGaugeColor }}
            ></div>
            <span className="text-xs">{oRisk.toUpperCase()}</span>
          </div>
          <div className="text-sm">
            Avg Score
            <div className="text-center text-lg font-semibold">{avg}</div>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col">
          <ScrollArea ref={transcriptRef} className="flex-1 rounded border bg-white p-2">
            {displayed.map((t) => {
              const isAgent = t.speaker === 'Agent AI';
              return (
                <div key={t.turnNumber} className="mb-2 flex items-start gap-2">
                  <span className="w-12 text-xs text-gray-500">{t.timestamp}</span>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isAgent ? 'text-blue-600' : 'text-gray-800'}`}>
                      {t.speaker}
                    </div>
                    <div className={`text-sm rounded p-1 ${isAgent ? 'bg-blue-50' : 'bg-gray-100'}`}>{t.text}</div>
                  </div>
                  <Badge style={riskStyles((t as any).label)}>
                    {(t as any).compositeScore}
                  </Badge>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: riskColor((t as any).label) }}
                  ></span>
                  {(t as any).label === 'critical' && t.critical && (
                    <Button
                      className="ml-2 px-2 py-1 text-xs"
                      style={{ backgroundColor: 'var(--risk-critical)', color: '#fff' }}
                      onClick={() => handleAction('Handoff requested')}
                    >
                      Escalate
                    </Button>
                  )}
                  {(t as any).label === 'warn' && t.critical && (
                    <Button
                      className="ml-2 px-2 py-1 text-xs"
                      style={{ backgroundColor: 'var(--risk-warn)', color: '#000' }}
                      onClick={() => handleAction('Agent will rephrase next turn')}
                    >
                      Rephrase
                    </Button>
                  )}
                </div>
              );
            })}
          </ScrollArea>
        </div>
        <div className="flex flex-col">
          <h2 className="mb-2 text-sm font-semibold">Event Log</h2>
          <ScrollArea className="flex-1 rounded border bg-white p-2">
            {events.length === 0 && (
              <p className="text-sm text-gray-500">No alerts</p>
            )}
            {events.map((e, idx) => (
              <div key={idx} className="mb-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{e.time}</span>
                  <Badge style={riskStyles(e.severity === 'major' ? 'critical' : 'warn')}>
                    {e.rule}
                  </Badge>
                </div>
                <div className="text-xs">{e.suggestedAction}</div>
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
      <footer className="mt-4 flex items-center justify-between">
        <Button onClick={toggleRun}>{running ? 'Stop' : 'Start'} simulation</Button>
        <div className="space-x-2">
          <Button
            className="bg-blue-500"
            onClick={() => handleAction('Summary exported')}
          >
            Export summary
          </Button>
          <Button
            className="bg-gray-500"
            onClick={() => handleAction('Back to overview')}
          >
            Back to Overview
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default function DemoCall() {
  return (
    <ToastProvider>
      <DemoInner />
    </ToastProvider>
  );
}
