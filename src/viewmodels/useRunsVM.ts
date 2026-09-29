import { navigate } from '../lib/router'
import { MODPACKS, ROUTE_OPTIONS } from '../prototype/fixtures'
import { protoActions, useProtoState } from '../prototype/state'
import type { RunsVM } from './types'

export function useRunsVM(): RunsVM {
  const state = useProtoState()
  return {
    runs: state.runs.map((run) => ({
      id: run.id,
      name: run.name,
      modpackLabel: MODPACKS.find((m) => m.id === run.modpackId)?.label ?? run.modpackId,
      routeLabel: ROUTE_OPTIONS.find((r) => r.id === run.route)?.label ?? run.route,
      dlc: run.dlc,
      updatedAt: run.updatedAt,
      unitCount: run.unitCount,
      pairCount: run.pairCount,
      active: state.activeRunId === run.id,
      onSelect: () => protoActions.selectRun(run.id),
      onDuplicate: () => void protoActions.duplicateRun(run.id),
      onDelete: () => protoActions.deleteRun(run.id),
      onExport: () => protoActions.copyShare(),
    })),
    activeRunId: state.activeRunId,
    onOpenSetup: () => navigate({ name: 'setup' }),
    onCreateRun: () => protoActions.createRun(),
    onImport: () => protoActions.copyShare(),
    onShareLink: () => protoActions.copyShare(),
    copied: state.copied,
    shareHint: 'Share links open straight into Preview. Export/import is one JSON file.',
  }
}
