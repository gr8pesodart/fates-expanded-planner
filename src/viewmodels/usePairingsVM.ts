import { navigate } from '../lib/router'
import { className, partnerOffer, personalGrowths, skillName, unitRow } from '../prototype/derive'
import {
  conflictMessage,
  conflictsFor,
  filterChips,
  pairsFor,
  rosterIds,
  sortLabel,
  sortOptions,
  visibleRoster,
} from '../prototype/selectors'
import { protoActions, useProtoState } from '../prototype/state'
import type { CompareColumnVM, CompareTrayVM, PairingsVM, PairCardVM } from './types'
import { corrinCardFor, offerFor, partnerSheetFor, runPillFor, spriteFor, talentSheetFor, unitSummaryFor } from './shared'

const routeIndex = (route: string) => (route === 'birthright' ? 0 : route === 'conquest' ? 1 : 2)

function personalSkillName(unitId: string, route: string): string {
  const row = unitRow(unitId)
  const id = row?.personal[routeIndex(route)] ?? row?.personal[2] ?? 0
  return skillName(id)
}

export function usePairingsVM(): PairingsVM {
  const state = useProtoState()
  const roster = visibleRoster(state)
  const columns: CompareColumnVM[] = state.pinnedIds
    .map((id) => {
      const offer = offerFor(id)
      return {
        id,
        name: unitRow(id)?.name ?? id,
        sprite: spriteFor(id),
        growths: personalGrowths(id, state.plans[id]?.variableParent),
        offer: offer.name,
        offerSkill: offer.skill,
        personalSkill: personalSkillName(id, state.route),
      }
    })

  const pairs = pairsFor(state)
  const pinnedPair = pairs.find((pair) => state.pinnedIds.includes(pair.a) && state.pinnedIds.includes(pair.b)) ?? null
  const childColumn: CompareColumnVM | null =
    pinnedPair && pinnedPair.childId
      ? {
          id: pinnedPair.childId,
          name: unitRow(pinnedPair.childId)?.name ?? pinnedPair.childId,
          sprite: spriteFor(pinnedPair.childId),
          growths: personalGrowths(pinnedPair.childId, pinnedPair.variableParentId),
          offer: '—',
          offerSkill: '—',
          personalSkill: personalSkillName(pinnedPair.childId, state.route),
          isChildPreview: true,
        }
      : null

  const tray: CompareTrayVM | null =
    columns.length === 0
      ? null
      : {
          columns: childColumn ? [...columns, childColumn] : columns,
          pinnedCount: columns.length,
          child:
            childColumn && pinnedPair
              ? {
                  id: childColumn.id,
                  name: childColumn.name,
                  growths: childColumn.growths,
                  inherits: className(partnerOffer(pinnedPair.variableParentId ?? '')?.classId ?? 0),
                }
              : null,
          onUnpin: (id) => protoActions.togglePin(id),
          onClear: () => protoActions.clearPins(),
          onOpenUnit: (id) => navigate({ name: 'unit', unitId: id }),
        }

  const pairCards: PairCardVM[] = pairs.map((pair) => {
    const child = pair.childId
      ? {
          id: pair.childId,
          name: unitRow(pair.childId)?.name ?? pair.childId,
          sprite: spriteFor(pair.childId),
          inheritedClass: className(partnerOffer(pair.variableParentId ?? '')?.classId ?? 0),
          growths: personalGrowths(pair.childId, pair.variableParentId),
          conflict: conflictMessage(state, pair.childId),
          onOpen: () => navigate({ name: 'unit', unitId: pair.childId! }),
        }
      : null
    return {
      id: pair.id,
      a: {
        id: pair.a,
        name: unitRow(pair.a)?.name ?? pair.a,
        sprite: spriteFor(pair.a),
        onOpen: () => navigate({ name: 'unit', unitId: pair.a }),
        onOpenPartner: () => protoActions.openPartnerSheet(pair.a, 'S'),
      },
      b: {
        id: pair.b,
        name: unitRow(pair.b)?.name ?? pair.b,
        sprite: spriteFor(pair.b),
        onOpen: () => navigate({ name: 'unit', unitId: pair.b }),
        onOpenPartner: () => protoActions.openPartnerSheet(pair.b, 'S'),
      },
      child,
      onOpenUnit: (id) => navigate({ name: 'unit', unitId: id }),
    }
  })

  return {
    runPill: runPillFor(state),
    query: state.query,
    onSearch: (query) => protoActions.setQuery(query),
    sortLabel: sortLabel(state),
    sorts: sortOptions(state).map((sort) => ({ ...sort, onSelect: () => protoActions.setSort(sort.id) })),
    filters: filterChips(state).map((filter) => ({ ...filter, onSelect: () => protoActions.setFilter(filter.id) })),
    units: roster.map((id) => unitSummaryFor(state, id)),
    totalCount: rosterIds(state).length,
    empty: roster.length > 0 ? 'none' : state.query.trim() || state.filterId !== 'all' ? 'filtered' : 'roster',
    onClearFilters: () => {
      protoActions.setQuery('')
      protoActions.setFilter('all')
    },
    tray,
    pairCards,
    conflicts: conflictsFor(state).map((conflict) => ({
      id: conflict.id,
      message: conflict.message,
      onOpen: () => navigate({ name: 'unit', unitId: conflict.unitIds[0] }),
    })),
    corrin: corrinCardFor(state),
    dlc: state.dlc,
    partnerSheet: partnerSheetFor(state),
    talentSheet: talentSheetFor(state),
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}
