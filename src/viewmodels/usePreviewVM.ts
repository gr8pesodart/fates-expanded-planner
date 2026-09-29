import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../data/assets'
import { useDataset } from '../data/useDataset'
import { getBuildProfile } from '../data/modProfiles'
import { ROUTES, STAT_LABELS, unitName } from '../data/types'
import { groupPreviewUnits } from '../logic/preview'
import { navigate, useRoute } from '../lib/router'
import { emptyRun, type RunPlan } from '../state/model'
import { decodeSharedRun, shareUrlForRun } from '../state/serialization'
import { usePlansStore } from '../state/store'
import type { PreviewFactVM, PreviewSlotVM, PreviewVM, RunPillVM } from './types'

const EMPTY_RUN = emptyRun('empty-run')

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

function runPillFor(run: RunPlan, readOnly: boolean): RunPillVM {
  const profile = getBuildProfile(run.modpackId)
  const route = ROUTES.find((candidate) => candidate.id === run.route) ?? ROUTES[2]
  return {
    runName: run.name,
    crest: run.name.trim().charAt(0).toUpperCase() || 'R',
    modpackLabel: profile.id === 'ugf-2.5.2' ? 'UGF 2.5.2' : profile.short,
    dlc: run.dlc,
    route: route.id,
    routeLabel: route.label,
    readOnly,
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}

function factsFor(
  run: RunPlan,
  unitId: string,
  dataset: NonNullable<ReturnType<typeof useDataset>['data']>,
): PreviewFactVM[] {
  const unit = dataset.unitsById.get(unitId)
  const plan = run.units[unitId]
  const facts: PreviewFactVM[] = []
  const name = (id: string) => unitName(dataset, id)

  if (unit?.isCorrin) {
    facts.push({ label: 'Corrin', value: run.corrin.gender === 'male' ? 'Male' : 'Female' })
    facts.push({ label: 'Boon', value: STAT_LABELS[run.corrin.boon] })
    facts.push({ label: 'Bane', value: STAT_LABELS[run.corrin.bane] })
    facts.push({
      label: 'Talent',
      value: run.corrin.talentClassId === null
        ? 'Not set'
        : dataset.classesById.get(run.corrin.talentClassId)?.name ?? `Class ${run.corrin.talentClassId}`,
    })
    if (plan?.sPartner) facts.push({ label: 'S', value: name(plan.sPartner) })
  } else if (unit?.fixedParent) {
    const parent = dataset.unitsById.get(unit.fixedParent)
    facts.push({ label: parent?.gender === 'female' ? 'Mum' : 'Dad', value: name(unit.fixedParent) })
    if (plan?.variableParent) {
      const variableParent = dataset.unitsById.get(plan.variableParent)
      facts.push({ label: variableParent?.gender === 'female' ? 'Mum' : 'Dad', value: name(plan.variableParent) })
    }
    if (plan?.inheritSkill !== undefined) {
      facts.push({ label: 'Inherits', value: dataset.skillsById.get(plan.inheritSkill)?.name ?? `Skill ${plan.inheritSkill}` })
    }
  }

  if (!unit?.isCorrin && plan?.sPartner) facts.push({ label: 'S', value: name(plan.sPartner) })
  if (plan?.aPlusPartner) facts.push({ label: 'A+', value: name(plan.aPlusPartner) })

  const routeClasses = plan?.classRoute.map((stop) => dataset.classesById.get(stop.classId)?.name ?? `Class ${stop.classId}`) ?? []
  const plannedClass = routeClasses.length > 0
    ? routeClasses.join(' → ')
    : plan?.classId === undefined
      ? null
      : dataset.classesById.get(plan.classId)?.name ?? `Class ${plan.classId}`
  if (plannedClass) facts.push({ label: 'Planned class', value: plannedClass, soft: true })

  for (const skillId of plan?.skills ?? []) {
    if (skillId === null) continue
    facts.push({ label: 'Skill', value: dataset.skillsById.get(skillId)?.name ?? `Skill ${skillId}`, soft: true })
  }
  return facts
}

export function usePreviewVM(): PreviewVM {
  const route = useRoute()
  const token = route.name === 'preview' ? route.shareToken : undefined
  const shared = useMemo(() => {
    if (token === undefined) return { run: null, error: null }
    try {
      return { run: decodeSharedRun(token), error: null }
    } catch (error) {
      return {
        run: null,
        error: error instanceof Error ? error.message : 'The share link is incomplete or invalid.',
      }
    }
  }, [token])

  const activeRun = usePlansStore((state) => state.runs.find((item) => item.id === state.activeRunId)) ?? EMPTY_RUN
  const isShared = token !== undefined
  const run = isShared ? shared.run ?? EMPTY_RUN : activeRun
  const shareError = isShared && !shared.run
    ? shared.error ?? 'The shared run could not be read.'
    : null
  const datasetResource = useDataset(getBuildProfile(run.modpackId).packId)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const dataset = datasetResource.data
  const corrin = dataset?.units.find((unit) => unit.isCorrin && unit.gender === run.corrin.gender)
  const roster = dataset
    ? dataset.units.filter((unit) =>
      unit.routes.includes(run.route) &&
      (run.dlc || !unit.dlc) &&
      (!unit.isCorrin || unit.gender === run.corrin.gender) &&
      (!unit.fixedParent || !dataset.unitsById.get(unit.fixedParent)?.isCorrin || unit.fixedParent === corrin?.id) &&
      (run.units[unit.id]?.inArmy ?? true),
    )
    : []
  const grouped = groupPreviewUnits(roster.map((unit) => unit.id), run.units)

  const slotFor = (unitId: string, role: PreviewSlotVM['role']): PreviewSlotVM => {
    const unit = dataset?.unitsById.get(unitId)
    const plan = run.units[unitId]
    return {
      id: unitId,
      name: unit?.name ?? unitName(dataset ?? null, unitId),
      sprite: {
        label: unit?.name ?? unitId,
        src: assetUrl('unit', unitId),
      },
      role,
      facts: dataset ? factsFor(run, unitId, dataset) : [],
      hanko: plan?.sPartner ? 'S' : plan?.aPlusPartner ? 'A+' : null,
      conflict: grouped.incompleteAssignments[unitId],
      onOpen: isShared ? () => undefined : () => navigate({ name: 'unit', unitId }),
    }
  }

  const duos = grouped.duos.map((duo) => ({
    id: `duo-${duo.front}-${duo.back}`,
    front: slotFor(duo.front, 'Front'),
    back: slotFor(duo.back, 'Back'),
  }))
  const routeForPill = shareError ? activeRun : run

  return {
    runPill: runPillFor(routeForPill, isShared),
    shareMode: isShared,
    shareError,
    loading: !shareError && datasetResource.loading,
    duoCount: duos.length,
    soloCount: grouped.solos.length,
    unassignedCount: grouped.unassigned.length,
    duos,
    solos: grouped.solos.map((id) => slotFor(id, 'Solo')),
    unassigned: grouped.unassigned.map((id) => slotFor(id, 'Solo')),
    copied,
    onCopyLink: () => {
      if (shareError) return
      void copyText(shareUrlForRun(run)).then((success) => {
        if (success) setCopied(true)
      })
    },
    onPrint: () => window.print(),
  }
}
