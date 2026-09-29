import { useEffect, useState } from 'react'
import { BUILD_PROFILES } from '../data/modProfiles'
import { loadDataset } from '../data/loader'
import { ROUTES } from '../data/types'
import { navigate } from '../lib/router'
import { usePlansStore } from '../state/store'
import type { RunPlan } from '../state/model'
import type { RunPillVM, SetupVM } from './types'

function profileLabel(modpackId: string): string {
  const profile = BUILD_PROFILES.find((candidate) => candidate.id === modpackId)
  if (profile?.id === 'vanilla') return 'Vanilla · data pending'
  return profile?.short ?? modpackId
}

function runPillFor(run: RunPlan | undefined): RunPillVM {
  const route = ROUTES.find((candidate) => candidate.id === run?.route) ?? ROUTES[2]
  const runName = run?.name ?? 'New run'
  return {
    runName,
    crest: runName.trim().charAt(0).toUpperCase() || 'R',
    modpackLabel: profileLabel(run?.modpackId ?? 'ugf-2.5.2'),
    dlc: run?.dlc ?? true,
    route: route.id,
    routeLabel: route.label,
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}

export function useSetupVM(): SetupVM {
  const state = usePlansStore()
  const activeRun = state.runs.find((run) => run.id === state.activeRunId) ?? state.runs[0]
  const [dlcCatalog, setDlcCatalog] = useState({
    classIds: new Set<number>(),
    skillIds: new Set<number>(),
    unitIds: new Set<string>(),
  })

  useEffect(() => {
    let current = true
    void loadDataset('ugf-2.5.2').then((dataset) => {
      if (current) setDlcCatalog({
        classIds: new Set(dataset.classes.filter((gameClass) => gameClass.dlc).map((gameClass) => gameClass.id)),
        skillIds: new Set([...dataset.skillsById.values()].filter((skill) => skill.dlc).map((skill) => skill.id)),
        unitIds: new Set(dataset.units.filter((unit) => unit.dlc).map((unit) => unit.id)),
      })
    }).catch(() => {
      if (current) setDlcCatalog({ classIds: new Set(), skillIds: new Set(), unitIds: new Set() })
    })
    return () => {
      current = false
    }
  }, [])

  const runId = activeRun?.id
  const relationshipSelections = Object.values(activeRun?.units ?? {}).filter((unit) => unit.sPartner || unit.aPlusPartner).length
  const dlcUses = Object.entries(activeRun?.units ?? {}).filter(([unitId, unit]) => {
    const classIds = [unit.classId, ...unit.classRoute.map((stop) => stop.classId)]
    return (unit.inArmy && dlcCatalog.unitIds.has(unitId)) ||
      classIds.some((classId) => classId !== undefined && dlcCatalog.classIds.has(classId)) ||
      unit.skills.some((skillId) => skillId !== null && dlcCatalog.skillIds.has(skillId))
  }).length

  return {
    runPill: runPillFor(activeRun),
    steps: [
      { id: 'modpack', index: 1, label: 'Modpack', hint: 'Who can support whom', done: Boolean(activeRun?.modpackId) },
      { id: 'dlc', index: 2, label: 'DLC', hint: 'Classes, seals and Anna', done: activeRun?.dlc !== undefined },
      { id: 'route', index: 3, label: 'Route', hint: 'Birthright, Conquest or Revelation', done: Boolean(activeRun?.route) },
      {
        id: 'run',
        index: 4,
        label: 'Name the run',
        hint: 'Shows on the header pill',
        done: Boolean(activeRun?.name.trim()),
      },
    ],
    modpacks: BUILD_PROFILES.map((profile) => ({
      id: profile.id,
      label: profile.id === 'vanilla' ? 'Vanilla Special Edition' : 'Unofficial Gay Fates 2.5.2',
      blurb: profile.id === 'vanilla'
        ? 'Retail support rules. Vanilla gameplay data is pending.'
        : 'Expanded support graph with same-sex S ranks, platonic A+ and fast supports.',
      installed: profile.id === 'ugf-2.5.2',
      supportNote: profile.id === 'vanilla' ? 'Vanilla data pending' : '2,463 support edges · 71 characters',
      selected: activeRun?.modpackId === profile.id,
      onSelect: () => {
        if (runId) state.updateRun(runId, { modpackId: profile.id })
      },
    })),
    dlc: activeRun?.dlc ?? true,
    onToggleDlc: () => {
      if (runId && activeRun) state.updateRun(runId, { dlc: !activeRun.dlc })
    },
    routes: ROUTES.map((route) => ({
      id: route.id,
      label: route.label,
      blurb: route.blurb,
      selected: activeRun?.route === route.id,
      onSelect: () => {
        if (runId) state.updateRun(runId, { route: route.id })
      },
    })),
    runName: activeRun?.name ?? '',
    onSetRunName: (name: string) => {
      if (runId) state.renameRun(runId, name)
    },
    firstRun: state.runs.length === 1 && activeRun?.name === 'New run' && Object.keys(activeRun.units).length === 0,
    onFinish: () => navigate({ name: 'pairings' }),
    onSkip: () => navigate({ name: 'pairings' }),
    modpackWarning: activeRun?.modpackId === 'vanilla' && relationshipSelections > 0
      ? `${relationshipSelections} relationship selections are saved, but vanilla support data is pending, so they cannot be checked against its support graph yet.`
      : null,
    dlcWarning: !activeRun?.dlc && dlcUses > 0
      ? `${dlcUses} plans use DLC classes — they stay listed with a warning chip instead of breaking.`
      : null,
  }
}
