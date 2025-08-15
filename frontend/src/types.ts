export type Speaker = 'Agent AI' | 'Customer'

export interface Turn {
  turnNumber: number
  timestamp: string
  speaker: Speaker
  text: string
  confidence: number
  critical: boolean
  keywordMatchScore: number
  expectedIntent: 'greeting' | 'verify_identity' | 'mini_miranda' | 'consent' | 'amount' | 'promise_to_pay' | 'wrapup'
  ruleTriggered: string[]
}

export interface ProcessedTurn extends Turn {
  compositeScore: number
  label: 'ok' | 'warn' | 'critical'
}

export interface EventLog {
  time: string
  rule: string
  severity: 'minor' | 'major'
  suggestedAction: string
}

export interface CallMeta {
  callId: string
  customerName: string
  startedAt: string
  timezone: string
}

export interface CallData extends CallMeta {
  transcript: Turn[]
}
