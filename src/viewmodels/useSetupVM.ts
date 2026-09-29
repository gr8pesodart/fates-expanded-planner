import { navigate } from '../lib/router'
import { MODPACKS, PROTO_CLASSES, ROUTE_OPTIONS } from '../prototype/fixtures'
import { protoActions, useProtoState } from '../prototype/state'
import type { SetupVM } from './types'
import { runPillFor } from './shared'

export function useSetupVM(): SetupVM {
  const state = useProtoState()

  const dlcUses = Object.values(state.plans).filter(
    (plan) =>
      plan.route.some((stop) => PROTO_CLASSES[stop.classId]?.dlc) ||
      (plan.classId !== undefined && PROTO_CLASSES[plan.classId]?.dlc),
  ).length

  const steps = [
    { id: 'modpack' as const, index: 1, label: 'Modpack', hint: 'Who can support whom', done: true },
    { id: 'dlc' as const, index: 2, label: 'DLC', hint: 'Classes, seals and Anna', done: true },
    { id: 'route' as const, index: 3, label: 'Route', hint: 'Birthright, Conquest or Revelation', done: true },
    {
      id: 'run' as const,
      index: 4,
      label: 'Name the run',
      hint: 'Shows on the header pill',
      done: state.runName.trim().length > 0,
    },
  ]

  return {
    runPill: runPillFor(state, true),
    steps,
    modpacks: MODPACKS.map((modpack) => ({
      id: modpack.id,
      label: modpack.label,
      blurb: modpack.blurb,
      installed: modpack.installed,
      supportNote: modpack.supportNote,
      selected: state.modpackId === modpack.id,
      onSelect: () => protoActions.setModpack(modpack.id),
    })),
    dlc: state.dlc,
    onToggleDlc: () => protoActions.toggleDlc(),
    routes: ROUTE_OPTIONS.map((route) => ({
      id: route.id,
      label: route.label,
      blurb: route.blurb,
      selected: state.route === route.id,
      onSelect: () => protoActions.setRoute(route.id),
    })),
    runName: state.runName,
    onSetRunName: (name: string) => protoActions.setRunName(name),
    firstRun: true,
    onFinish: () => navigate({ name: 'pairings' }),
    onSkip: () => navigate({ name: 'pairings' }),
    dlcWarning:
      !state.dlc && dlcUses > 0
        ? `${dlcUses} plans use DLC classes — they stay listed with a warning chip instead of breaking.`
        : null,
  }
}
