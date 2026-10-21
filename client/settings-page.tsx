/**
 * Wind target-model configuration page for the Plugins area.
 *
 * The Host projects every Loader entry's volatile Config into the settings
 * document, so this page finds the wind entry's namespace by its Config shape
 * (the injected instance and the bundle row use different entry ids), renders
 * the live model catalogue of every imported provider, and writes the selected
 * model ids back through the same config form the Host validates.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

/** Translation seat supplied by the slot renderer through `locale: 'wind'`. */
export type WindTranslate = (key: string, vars?: Record<string, string>) => string

/** One adapter catalogue entry. */
export interface WindModelEntry {
  id: string
  name: string
}

/** One imported provider and its advertised models. */
export interface WindProviderGroup {
  id: string
  name: string
  models: WindModelEntry[]
}

/** Answer of the Host model catalogue request. */
export type WindCatalogResult =
  | { ok: true; value: { groups: WindProviderGroup[]; failures?: unknown[] } }
  | { ok: false; error?: unknown }

/** Snapshot of one settings namespace's generated form. */
export interface WindConfigFormSnapshot {
  status?: 'idle' | 'loading' | 'ready' | 'error'
  value?: unknown
  revision?: number
  writable?: boolean
}

/** The shared config-form handle for one Host entry. */
export interface WindConfigForm {
  getSnapshot(): WindConfigFormSnapshot
  subscribe(listener: () => void): () => void
  mutate(operations: unknown[], revision?: number): Promise<unknown>
}

/** The describe mirror shared by every settings consumer. */
export interface WindDescribeFace {
  getSnapshot(): { view?: { namespaces: ReadonlyArray<{ ns: string; value?: unknown }> } }
  subscribe(listener: () => void): () => void
  ensure(): Promise<void>
}

/** Client subset of the settings service this page needs. */
export interface WindConfigFormsFace {
  get<T>(namespace: string): WindConfigForm
  describe(): WindDescribeFace
  whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void
}

/** Client subset of the Host model catalogue transport. */
export interface WindRemoteFace {
  session?: { modelCatalog(): Promise<WindCatalogResult> }
}

/** Props the page receives from the Plugins slot. */
export interface WindTargetsPageProps {
  /** Plugins page view selector (summary in the list, page on the detail page). */
  view?: 'summary' | 'page'
  /** Injected config-form handle (named apart from the page-owned `form` prop). */
  windForm: WindConfigForm
  loadCatalog: () => Promise<WindCatalogResult>
  t?: WindTranslate
}

function isWindValue(value: unknown): value is { targetModels?: unknown } {
  if (typeof value !== 'object' || value === null) return false
  // The settings form projects exactly the volatile Config fields.
  return Array.isArray((value as { targetModels?: unknown }).targetModels)
    && typeof (value as { matchV4Fallback?: unknown }).matchV4Fallback === 'boolean'
}

/** Locate the wind entry namespace from the served settings document. */
export function findWindNamespace(forms: WindConfigFormsFace): string | undefined {
  const view = forms.describe().getSnapshot().view
  return view?.namespaces.find((entry) => isWindValue(entry.value))?.ns
}

/** The model ids configured today, falling back to the shipped defaults. */
function configuredModels(snapshot: WindConfigFormSnapshot): string[] {
  const value = snapshot.value
  if (value === null || typeof value !== 'object') return []
  const models = (value as { targetModels?: unknown }).targetModels
  return Array.isArray(models) ? models.filter((model): model is string => typeof model === 'string') : []
}

function fallbackT(key: string): string {
  return key
}

/** Merge catalogue models with configured ids that no longer appear in it. */
function mergedGroups(groups: readonly WindProviderGroup[], configured: readonly string[]): WindProviderGroup[] {
  const known = new Set(groups.flatMap((group) => group.models.map((model) => model.id)))
  const stale = configured.filter((model) => !known.has(model))
  if (stale.length === 0) return [...groups]
  return [...groups, { id: '', name: '', models: stale.map((id) => ({ id, name: id })) }]
}

/**
 * Render the Plugins-area configuration page for wind target models.
 * @param props - form handle, catalogue loader, and the locale-bound translator.
 * @returns The page element.
 */
export function WindTargetsPage({ view, windForm, loadCatalog, t: tf }: WindTargetsPageProps): React.ReactElement {
  const t = tf ?? fallbackT
  // Call through the form object: the controller methods read instance state.
  const snapshot = useSyncExternalStore(
    (listener) => windForm.subscribe(listener),
    () => windForm.getSnapshot(),
  )
  const configured = configuredModels(snapshot)
  const [catalog, setCatalog] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; groups: WindProviderGroup[] }>({ status: 'idle', groups: [] })
  const [draft, setDraft] = useState<string[] | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const revision = snapshot.revision

  useEffect(() => {
    setDraft(undefined)
  }, [revision])

  useEffect(() => {
    let alive = true
    setCatalog({ status: 'loading', groups: [] })
    loadCatalog()
      .then((result) => {
        if (!alive) return
        if (result.ok) setCatalog({ status: 'ready', groups: result.value.groups })
        else setCatalog({ status: 'error', groups: [] })
      })
      .catch(() => {
        if (alive) setCatalog({ status: 'error', groups: [] })
      })
    return () => { alive = false }
  }, [loadCatalog])

  const selected = useMemo(() => draft ?? configured, [draft, configured])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const groups = useMemo(() => mergedGroups(catalog.groups, configured), [catalog.groups, configured])
  const dirty = selected.length !== configured.length || selected.some((model) => !configured.includes(model))

  if (view === 'summary') {
    return <span>{t('targetsSummary', { count: String(configured.length) })}</span>
  }

  const toggle = (model: string): void => {
    const next = selectedSet.has(model) ? selected.filter((item) => item !== model) : [...selected, model]
    setDraft(next)
    setError(undefined)
  }

  const save = async (): Promise<void> => {
    if (saving || !dirty) return
    setSaving(true)
    setError(undefined)
    try {
      await windForm.mutate([{ op: 'set', path: ['targetModels'], value: selected }], revision)
      setDraft(undefined)
    } catch (failure) {
      setError(String(failure))
    } finally {
      setSaving(false)
    }
  }

  const readonly = snapshot.writable === false
  const statusText = catalog.status === 'loading'
    ? t('targetsCatalogLoading')
    : catalog.status === 'error'
      ? t('targetsCatalogError')
      : t('targetsCatalogHint', { count: String(selected.length) })

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }
  const section: React.CSSProperties = { display: 'grid', gap: 4, marginTop: 6 }
  const provider: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginTop: 10 }

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('targetsTitle')}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{t('targetsDescription')}</div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{statusText}</div>
      {groups.length === 0 && catalog.status === 'ready' ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>{t('targetsEmpty')}</div>
      ) : null}
      {groups.map((group) => (
        <section key={group.id || '__stale'} style={section}>
          {group.name !== '' ? <div style={provider}>{group.name}</div> : <div style={provider}>{t('targetsStale')}</div>}
          {group.models.map((model) => (
            <label key={group.id + ':' + model.id} style={{ ...row, cursor: readonly ? 'default' : 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedSet.has(model.id)}
                disabled={readonly || saving}
                onChange={() => toggle(model.id)}
              />
              <span style={{ fontSize: 13 }}>{model.name}</span>
              <span style={{ fontSize: 11, opacity: 0.5 }}>{model.id}</span>
            </label>
          ))}
        </section>
      ))}
      {error !== undefined ? <div style={{ fontSize: 12, color: 'var(--dsw-danger, #c0392b)' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" disabled={readonly || saving || !dirty} onClick={() => { void save() }}>
          {saving ? t('targetsSaving') : t('targetsSave')}
        </button>
        <button type="button" disabled={saving || draft === undefined} onClick={() => { setDraft(undefined); setError(undefined) }}>
          {t('targetsDiscard')}
        </button>
      </div>
      {readonly ? <div style={{ fontSize: 12, opacity: 0.7 }}>{t('targetsReadonly')}</div> : null}
    </div>
  )
}

/**
 * Watch the settings document for the wind entry and register the page once its
 * namespace is served. Covers both the injected entry (random id) and the
 * bundle row (`dsh-wind-integration`).
 * @param forms - settings service face.
 * @param slots - slot registry face.
 * @param remote - Host catalogue transport.
 * @param translate - locale-bound translator used for the slot label.
 * @returns Disposer ending the watch and the page registration.
 */
export function registerWindTargetsPage(
  forms: WindConfigFormsFace,
  slots: { inject(name: string, register: () => unknown): unknown; register(options: object, component: unknown): () => void },
  remote: WindRemoteFace,
  translate: WindTranslate,
): () => void {
  let pageOff: (() => void) | undefined
  let watched: string | undefined
  const loadCatalog = (): Promise<WindCatalogResult> => {
    const session = remote.session
    if (session === undefined) return Promise.resolve({ ok: false, error: 'model catalogue unavailable' })
    return session.modelCatalog()
  }
  const sync = (): void => {
    const entries = forms.describe().getSnapshot().view?.namespaces
    const namespace = findWindNamespace(forms)
    if (namespace === watched) return
    pageOff?.()
    pageOff = undefined
    watched = namespace
    if (namespace === undefined) return
    const form = forms.get<unknown>(namespace)
    pageOff = forms.whileServed([namespace], () => slots.inject('plugins.item', () => slots.register({
      name: 'plugins.item',
      id: 'wind-targets',
      order: 60,
      label: () => translate('targetsItemTitle'),
      locale: 'wind',
      inject: () => ({ windForm: form, loadCatalog }),
    }, WindTargetsPage)))
  }
  const describe = forms.describe()
  const unsubscribe = describe.subscribe(sync)
  void describe.ensure()
  sync()
  return () => {
    unsubscribe()
    pageOff?.()
  }
}
