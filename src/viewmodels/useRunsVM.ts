import { useEffect, useState } from 'react'
import { BUILD_PROFILES, getBuildProfile } from '../data/modProfiles'
import { loadDataset } from '../data/loader'
import { ROUTES } from '../data/types'
import type { Dataset } from '../data/types'
import { navigate } from '../lib/router'
import { PLAN_SCHEMA } from '../state/model'
import { parsePlanDocument, serializePlanDocument, shareUrlForRun } from '../state/serialization'
import type { PlanDocument, RunPlan } from '../state/model'
import { usePlansStore } from '../state/store'
import type { RunsVM } from './types'

function profileLabel(modpackId: string): string {
  const profile = BUILD_PROFILES.find((profile) => profile.id === modpackId)
  if (profile?.id === 'vanilla') return 'Vanilla · data pending'
  return profile?.short ?? modpackId
}

function routeLabel(routeId: string): string {
  return ROUTES.find((route) => route.id === routeId)?.label ?? routeId
}

function updatedAtLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function unitCount(run: RunPlan, dataset: Dataset | undefined): number {
  if (!dataset) return Object.values(run.units).filter((unit) => unit.inArmy).length
  return dataset.units.filter((unit) =>
    unit.routes.includes(run.route) && (run.dlc || !unit.dlc) && (run.units[unit.id]?.inArmy ?? true),
  ).length
}

function pairCount(run: RunPlan): number {
  const pairs = new Set<string>()
  for (const [unitId, unit] of Object.entries(run.units)) {
    for (const partnerId of [unit.sPartner, unit.aPlusPartner]) {
      if (!partnerId || partnerId === unitId) continue
      pairs.add([unitId, partnerId].sort().join('\u0000'))
    }
  }
  return pairs.size
}

function downloadJson(filename: string, json: string): void {
  const safeName = [...filename].map((character) =>
    /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '-' : character,
  ).join('').trim().replace(/\s+/g, ' ') || 'fates-run'
  const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `${safeName}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Clipboard access can be unavailable on local or restricted origins.
    }
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  input.remove()
  return copied
}

function showImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'The file could not be imported.'
  window.alert(message)
}

function importDocument(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.hidden = true
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    void file.text().then((text) => {
      const document = parsePlanDocument(text)
      if (document.runs.length === 0) throw new Error('This export does not contain any runs.')
      usePlansStore.getState().replaceDocument(document)
    }).catch(showImportError)
  }, { once: true })
  document.body.append(input)
  window.addEventListener('focus', () => window.setTimeout(() => input.remove(), 500), { once: true })
  input.click()
}

function exportRun(run: RunPlan): void {
  const document: PlanDocument = { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }
  downloadJson(run.name, serializePlanDocument(document))
}

export function useRunsVM(): RunsVM {
  const state = usePlansStore()
  const [copied, setCopied] = useState(false)
  const [datasets, setDatasets] = useState<Record<string, Dataset>>({})
  const activeRun = state.runs.find((run) => run.id === state.activeRunId) ?? state.runs[0]
  const packKey = [...new Set(state.runs.map((run) => getBuildProfile(run.modpackId).packId))].sort().join('|')

  useEffect(() => {
    let current = true
    const packIds = packKey ? packKey.split('|') : []
    void Promise.all(packIds.map(async (packId) => {
      try {
        return [packId, await loadDataset(packId)] as const
      } catch {
        return null
      }
    })).then((loaded) => {
      if (!current) return
      const next: Record<string, Dataset> = {}
      for (const item of loaded) if (item) next[item[0]] = item[1]
      setDatasets(next)
    })
    return () => {
      current = false
    }
  }, [packKey])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  return {
    runs: state.runs.map((run) => ({
      id: run.id,
      name: run.name,
      modpackLabel: profileLabel(run.modpackId),
      routeLabel: routeLabel(run.route),
      dlc: run.dlc,
      updatedAt: updatedAtLabel(run.updatedAt),
      unitCount: unitCount(run, datasets[getBuildProfile(run.modpackId).packId]),
      pairCount: pairCount(run),
      active: state.activeRunId === run.id,
      onSelect: () => state.selectRun(run.id),
      onDuplicate: () => { state.duplicateRun(run.id) },
      onDelete: () => state.deleteRun(run.id),
      onExport: () => exportRun(run),
    })),
    activeRunId: activeRun?.id ?? '',
    onOpenSetup: () => navigate({ name: 'setup' }),
    onCreateRun: () => state.createRun(),
    onImport: importDocument,
    onShareLink: () => {
      if (!activeRun) return
      void copyText(shareUrlForRun(activeRun)).then((success) => {
        if (success) setCopied(true)
      })
    },
    copied,
    shareHint: 'Export saves one run as JSON. Import replaces your runs with a full JSON backup. Share links open the active run in Preview.',
  }
}
