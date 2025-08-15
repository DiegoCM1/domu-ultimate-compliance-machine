import React, { useEffect, useState } from 'react'
import { mockCall } from './mockData'
import { Turn, ProcessedTurn, EventLog } from './types'

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

const scoreColor = (label: string) => {
  switch (label) {
    case 'ok':
      return 'bg-riskGreen'
    case 'warn':
      return 'bg-riskYellow'
    case 'critical':
      return 'bg-riskRed'
    default:
      return 'bg-gray-400'
  }
}

const dotColor = (label: string) => {
  switch (label) {
    case 'ok':
      return 'text-riskGreen'
    case 'warn':
      return 'text-riskYellow'
    case 'critical':
      return 'text-riskRed'
    default:
      return 'text-gray-400'
  }
}

const riskColor = (risk: string) => {
  switch (risk) {
    case 'ok':
      return 'bg-riskGreen'
    case 'warn':
      return 'bg-riskYellow'
    case 'critical':
      return 'bg-riskRed'
    default:
      return 'bg-gray-400'
  }
}

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const App: React.FC = () => {
  const call = mockCall
  const [current, setCurrent] = useState(0)
  const [turns, setTurns] = useState<ProcessedTurn[]>([])
  const [events, setEvents] = useState<EventLog[]>([
    { time: '00:00', rule: 'late_call', severity: 'minor', suggestedAction: 'QA flag' },
  ])
  const [elapsed, setElapsed] = useState(0)
  const [overallRisk, setOverallRisk] = useState<'ok' | 'warn' | 'critical'>('ok')
  const [compositeAvg, setCompositeAvg] = useState(100)

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (current >= call.transcript.length) return
    const id = setInterval(() => {
      const raw = call.transcript[current]
      const processed = processTurn(raw)
      setTurns((prev) => [...prev, processed])
      setCurrent((c) => c + 1)
    }, 900)
    return () => clearInterval(id)
  }, [current])

  useEffect(() => {
    const recent = turns.slice(-5)
    const avg =
      recent.reduce((sum, t) => sum + t.compositeScore, 0) / (recent.length || 1)
    const hasMajor = events.slice(-5).some((e) => e.severity === 'major')
    let risk: 'ok' | 'warn' | 'critical' = 'ok'
    if (avg < 65 || hasMajor) risk = 'critical'
    else if (avg < 80 || events.length > 0) risk = 'warn'
    setCompositeAvg(Math.round(avg))
    setOverallRisk(risk)
  }, [turns, events])

  function processTurn(turn: Turn): ProcessedTurn {
    const asr = turn.confidence * 100
    const keyword = turn.keywordMatchScore * 100
    const flow = 100
    let base = 0.5 * asr + 0.4 * keyword + 0.1 * flow
    if (turn.critical && turn.keywordMatchScore < 0.5) base -= 15
    if (turn.critical && turn.confidence < 0.6) base -= 10
    const compositeScore = clamp(base)
    const label: 'ok' | 'warn' | 'critical' =
      compositeScore >= 80 ? 'ok' : compositeScore >= 60 ? 'warn' : 'critical'

    const rules: string[] = []
    if (turn.expectedIntent === 'mini_miranda' && turn.keywordMatchScore < 0.5) {
      rules.push('missing_disclosure')
    }
    if (turn.expectedIntent === 'consent' && !/sí|si|acepto/i.test(turn.text)) {
      rules.push('missing_consent')
    }
    if (turn.expectedIntent === 'amount' && turn.keywordMatchScore < 0.6) {
      rules.push('amount_mismatch')
    }
    if (turn.speaker === 'Agent AI' && /pagar ya/i.test(turn.text)) {
      rules.push('harsh_tone')
    }
    rules.forEach((r) => {
      const severity = r === 'missing_consent' || r === 'missing_disclosure' ? 'major' : 'minor'
      const action =
        r === 'missing_consent' ? 'Escalate' : r === 'harsh_tone' ? 'Rephrase' : 'QA flag'
      setEvents((ev) => [...ev, { time: turn.timestamp, rule: r, severity, suggestedAction: action }])
    })
    return { ...turn, compositeScore, label, ruleTriggered: [...turn.ruleTriggered, ...rules] }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white p-4">
        <div>
          <div className="font-semibold">{call.callId}</div>
          <div className="text-sm text-gray-600">{call.customerName}</div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{formatTime(elapsed)}</span>
          <span className={`px-3 py-1 text-white rounded ${riskColor(overallRisk)}`}>
            {overallRisk.toUpperCase()}
          </span>
          <span className="text-sm">Avg {compositeAvg}</span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4">
          {turns.map((t) => (
            <div key={t.turnNumber} className="mb-2 flex items-start gap-2">
              <span className="w-12 text-xs text-gray-500">{t.timestamp}</span>
              <div className="flex-1">
                <div className="text-xs font-semibold">{t.speaker}</div>
                <div>{t.text}</div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`rounded px-1 text-xs text-white ${scoreColor(t.label)}`}>
                  {t.compositeScore}
                </span>
                <span className={`text-lg leading-none ${dotColor(t.label)}`}>•</span>
                {t.label === 'critical' && t.critical && (
                  <button
                    className="ml-1 rounded border px-2 py-0.5 text-xs"
                    onClick={() => alert('Agent will rephrase next turn')}
                  >
                    Rephrase
                  </button>
                )}
              </div>
            </div>
          ))}
        </main>
        <aside className="w-64 border-l bg-white p-4 overflow-y-auto">
          <h2 className="mb-2 font-semibold">Event Log</h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">Sin alertas</p>
          ) : (
            events.map((e, i) => (
              <div key={i} className="mb-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">{e.time}</span>
                  <span className={e.severity === 'major' ? 'text-riskRed' : 'text-riskYellow'}>
                    {e.rule}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="capitalize">{e.severity}</span>
                  <span className="italic">{e.suggestedAction}</span>
                </div>
              </div>
            ))
          )}
        </aside>
      </div>
      <footer className="flex gap-2 border-t bg-white p-4">
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => alert('Export not implemented')}
        >
          Export summary
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => alert('Back')}>Back to Overview</button>
      </footer>
    </div>
  )
}

export default App
