import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { Chip, ChipButton } from '../components/Chip'
import { CompareTray } from '../components/CompareTray'
import { CorrinCard } from '../components/CorrinCard'
import { EmptyState } from '../components/EmptyState'
import { PairCard } from '../components/PairCard'
import { PartnerOptionRow } from '../components/PartnerOptionRow'
import { Sprite } from '../components/Sprite'
import { UnitRow } from '../components/UnitRow'
import { usePairingsVM } from '../viewmodels/usePairingsVM'

export function PairingsScreen() {
  const vm = usePairingsVM()
  const [sortOpen, setSortOpen] = useState(false)

  const sheetTitle =
    vm.partnerSheet?.rank === 'S' ? 'S partner' : vm.partnerSheet?.rank === 'A+' ? 'A+ partner' : 'Variable parent'

  return (
    <section className="pairings" data-testid="pairings">
      <div className="searchbar">
        <input
          type="search"
          value={vm.query}
          placeholder="Search units, classes, skills"
          aria-label="Search units"
          onChange={(event) => vm.onSearch(event.target.value)}
        />
        <button type="button" className="btn ghost sortbtn" aria-expanded={sortOpen} onClick={() => setSortOpen((open) => !open)}>
          {vm.sortLabel}
        </button>
      </div>

      {sortOpen ? (
        <div className="scroller sortrow">
          {vm.sorts.map((sort) => (
            <ChipButton key={sort.id} active={sort.active} variant="accent" onClick={sort.onSelect}>
              {sort.label} ↓
            </ChipButton>
          ))}
        </div>
      ) : null}

      <div className="scroller filterrow">
        {vm.filters.map((filter) => (
          <ChipButton
            key={filter.id}
            active={filter.active}
            variant={filter.warn && filter.count > 0 ? 'warn' : filter.active ? 'accent' : 'plain'}
            onClick={filter.onSelect}
          >
            {filter.label}
            {filter.id !== 'all' && filter.count > 0 ? <span className="num"> {filter.count}</span> : null}
            {filter.id === 'all' ? <span className="num"> {filter.count}</span> : null}
          </ChipButton>
        ))}
      </div>

      {vm.dlc ? null : (
        <div className="dlcbanner">
          <Chip variant="warn">DLC off</Chip>
          <span className="muted">DLC classes and Anna are hidden from every pool.</span>
        </div>
      )}

      {vm.conflicts.length > 0 ? (
        <div className="conflictlist">
          {vm.conflicts.map((conflict) => (
            <button type="button" className="card conflict" key={conflict.id} onClick={conflict.onOpen}>
              <Chip variant="warn">!</Chip>
              <span>{conflict.message}</span>
            </button>
          ))}
        </div>
      ) : null}

      {vm.empty === 'filtered' ? (
        <EmptyState
          kicker="No matches"
          title="Nothing fits those filters"
          body="Try a different search or clear the filters — 71 units are in this build."
          actionLabel="Clear filters"
          onAction={vm.onClearFilters}
        />
      ) : vm.empty === 'roster' ? (
        <EmptyState
          kicker="Empty roster"
          title="No units in this run yet"
          body="Add units from the setup screen or switch runs."
          actionLabel="Open setup"
          onAction={vm.onOpenSetup}
        />
      ) : (
        <>
          {vm.corrin ? <CorrinCard vm={vm.corrin} /> : null}

          {vm.pairCards.length > 0 ? (
            <>
              <h2 className="sectiontitle">Pairs &amp; children</h2>
              <div className="pairlist">
                {vm.pairCards.map((pair) => (
                  <PairCard key={pair.id} vm={pair} />
                ))}
              </div>
            </>
          ) : null}

          <h2 className="sectiontitle">
            Roster{' '}
            <span className="num muted">
              {vm.units.length}/{vm.totalCount}
            </span>
          </h2>
          <div className="unitlist">
            {vm.units.map((unit) => (
              <UnitRow key={unit.id} vm={unit} />
            ))}
          </div>
        </>
      )}

      {vm.tray ? <CompareTray vm={vm.tray} /> : null}

      <BottomSheet
        open={Boolean(vm.partnerSheet)}
        title={sheetTitle}
        subtitle={vm.partnerSheet ? `${vm.partnerSheet.unitName} · filtered by the installed support graph` : undefined}
        onClose={vm.partnerSheet?.onClose ?? (() => undefined)}
        testId="partner-sheet"
      >
        {vm.partnerSheet ? (
          <div className="optionlist">
            <button type="button" className="linkish" onClick={vm.partnerSheet.onClear}>
              Clear current {sheetTitle.toLowerCase()}
            </button>
            {vm.partnerSheet.options.map((option) => (
              <PartnerOptionRow key={option.id} vm={option} rank={vm.partnerSheet!.rank} />
            ))}
            {vm.partnerSheet.options.length === 0 ? (
              <p className="muted">No support options in this pack for this unit.</p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(vm.talentSheet)}
        title="Corrin talent"
        subtitle="Grants a whole class branch to Corrin and Kana"
        onClose={vm.talentSheet?.onClose ?? (() => undefined)}
        testId="talent-sheet"
      >
        {vm.talentSheet ? (
          <div className="optionlist">
            {vm.talentSheet.options.map((option) => (
              <button
                type="button"
                key={option.classId}
                className={['rowitem', option.current ? 'current' : ''].filter(Boolean).join(' ')}
                onClick={option.onPick}
              >
                <Sprite label={option.name} src={option.sprite.src} size="sm" />
                <span className="rowbody">
                  <span className="rowname">{option.name}</span>
                </span>
                <span className="rowcheck" aria-hidden="true">
                  {option.current ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </BottomSheet>
    </section>
  )
}
