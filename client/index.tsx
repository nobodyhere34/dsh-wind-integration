/**
 * dsh-wind-integration client bundle — a Cordis function plugin the client
 * module runner activates: registers the `wind` locale namespace and one
 * status indicator in the sidebar footer (sidebar.footer.action seat).
 *
 * The card fetches the host-only /wind/status snapshot on mount and renders
 * the current overlay state with locale-owned copy only. When the sidebar
 * runs in rail mode (wide = false) it collapses to a single state dot; the
 * title/aria text still carries the locale copy. If the host route is
 * unavailable the indicator degrades to the inactive copy.
 */
import React, { useEffect, useState } from 'react'
import { zh, en } from './dicts.ts'

export const name = 'dsh-wind-client'
export const inject = ['slots', 'locale']
export const NS = 'wind'
export { zh, en }

interface WindLatest {
  sid: string
  model?: string
  /** The model gate passed at least once for this session. */
  engaged?: boolean
  /** Why wind currently does not participate; absent while live. */
  lastSkip?: { reason: 'model' | 'preset' | 'session' | 'ended'; preset?: string }
  band?: string
  stage?: number
  stageTotal?: number
  guided?: boolean
  restrictApplied?: boolean
  injectedAssemblies?: number
  enabled?: boolean
}

interface WindStatusPayload {
  plugin?: string
  version?: string
  active?: boolean
  targetModels?: string[]
  latest?: WindLatest | null
}

interface WindCardProps {
  /** Sidebar owner share: whether the sidebar draws the wide row. */
  wide?: boolean
  /** Locale-bound translator supplied by the slot renderer (locale: 'wind'). */
  t?: (key: string, vars?: Record<string, string>) => string
}

/** Client-side context subset this plugin touches (services declared in inject). */
interface WindClientContext {
  effect(fn: () => unknown, label?: string): unknown
  locale?: { register(namespace: string, dict: Record<string, unknown>): unknown }
  slots?: {
    inject(name: string, register: () => unknown): unknown
    register(opts: object, component: unknown): () => void
  }
}

export function apply(ctx: WindClientContext): void {
  ctx.effect(() => {
    if (ctx.locale && typeof ctx.locale.register === 'function') {
      ctx.locale.register('wind', { zh, en })
    }
  }, 'dsh-wind: copy dictionaries')

  ctx.effect(() => {
    if (ctx.slots && typeof ctx.slots.inject === 'function' && typeof ctx.slots.register === 'function') {
      return ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'wind-status',
        order: 200,
        locale: 'wind',
      }, WindStatusCard))
    }
    return undefined
  }, 'dsh-wind: sidebar footer status indicator')
}

function useWindStatus(): WindStatusPayload | undefined {
  const [status, setStatus] = useState<WindStatusPayload | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/wind/status', { credentials: 'same-origin' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          if (alive) setStatus(data as WindStatusPayload)
        })
        .catch(() => {
          if (alive) setStatus(undefined)
        })
    }
    load()
    // The pill reports a moving session fact: the most recently observed
    // session changes as sessions start, engage, and stop. One fetch on mount
    // freezes the card at the page-load state.
    const timer = setInterval(load, 4000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  return status
}

function resolveLang(): 'zh' | 'en' {
  try {
    const lang = (typeof navigator !== 'undefined' ? navigator.language : 'zh').toLowerCase()
    return lang.startsWith('en') ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

function dictT(lang: 'zh' | 'en'): (key: string, vars?: Record<string, string>) => string {
  const dict = lang === 'en' ? en : zh
  return (key: string, vars?: Record<string, string>) => {
    let text = (dict as Record<string, string>)[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.split('{' + k + '}').join(v)
    }
    return text
  }
}

function detailOf(status: WindStatusPayload | undefined, tt: (key: string, vars?: Record<string, string>) => string): string {
  const latest = status?.latest ?? null
  if (!latest) return tt('statusIdle')
  const model = latest.model ?? status?.targetModels?.[0] ?? ''
  const withModel = (key: string) => tt(key, model === '' ? {} : { model })
  if (latest.engaged && latest.lastSkip === undefined) return tt('statusActive', model === '' ? {} : { model })
  switch (latest.lastSkip?.reason) {
    case 'preset':
      return tt('statusPresetSkipped', { preset: latest.lastSkip?.preset ?? '' })
    case 'session':
      return withModel('statusDisabled')
    case 'ended':
      return withModel('statusEnded')
    default:
      // 'model' or an engaged-then-idle gap: name the route the gate rejected.
      return model === '' ? tt('statusModelUnknown') : withModel('statusInactive')
  }
}

const detail: React.CSSProperties = { fontSize: 13, opacity: 0.85, lineHeight: '18px', whiteSpace: 'nowrap' }
const title: React.CSSProperties = { fontSize: 13, lineHeight: '18px', whiteSpace: 'nowrap' }

function WindStatusCard(props: WindCardProps): React.ReactElement {
  const { wide, t: tf } = props
  const status = useWindStatus()
  const tt = tf ?? dictT(resolveLang())
  const latest = status?.latest ?? null
  const primary = detailOf(status, tt)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (status?.latest?.enabled !== undefined) setEnabled(status.latest.enabled)
  }, [status])

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const sid = latest?.sid
    if (!sid) return
    const next = e.target.checked
    setEnabled(next)
    fetch('/wind/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ sid, enabled: next }),
    }).catch(() => setEnabled(!next))
  }

  // Rail mode: a single state dot (inherited color, opacity marks active).
  if (wide === false) {
    const active = !!(status && status.active && latest)
    return (
      <div
        role="status"
        title={tt('statusTitle') + ' — ' + primary}
        aria-label={tt('statusTitle') + ' — ' + primary}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28, cursor: 'default' }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 4,
            background: 'currentColor',
            opacity: active ? 1 : 0.35,
          }}
        />
      </div>
    )
  }

  const secondary: string | null =
    status && latest && status.active && latest.band !== undefined
      ? tt('statusBand', { band: latest.band }) +
        ' · ' + tt('statusStage', { stage: String(latest.stage ?? 1) + '/' + String(latest.stageTotal ?? 3) }) +
        (latest.guided ? ' · ' + tt('statusGuided') : '') +
        (latest.restrictApplied ? ' · ' + tt('statusRestricted') : '')
      : null

  return (
    <div role="status" style={{ paddingTop: 2, paddingBottom: 2, maxWidth: 240 }}>
      <div style={title}>{tt('statusTitle')}</div>
      <div style={detail}>{primary}</div>
      {secondary ? <div style={detail}>{secondary}</div> : null}
      {latest ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled ?? status?.latest?.enabled ?? true}
            onChange={handleToggle}
            style={{ accentColor: 'currentColor', width: 13, height: 13 }}
          />
          <span style={{ fontSize: 12, opacity: 0.85, whiteSpace: 'nowrap' }}>{tt('windToggle')}</span>
        </label>
      ) : null}
    </div>
  )
}

// Function-plugin form: named name/inject/apply only. A `default` export here
// would win Loader.unwrapExports' `default ?? exports` and drop the namespace.
