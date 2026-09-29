import type { CorrinCardVM } from '../viewmodels/types'
import { Chip, ChipButton } from './Chip'
import { Sprite } from './Sprite'

export function CorrinCard({ vm }: { vm: CorrinCardVM }) {
  return (
    <article className="card corrincard" data-testid="corrin-card">
      <header className="corrinhead">
        <Sprite label={vm.name} src={vm.sprite.src} size="lg" />
        <div>
          <span className="kicker">Define Corrin</span>
          <h3>{vm.name}</h3>
          <div className="seg" role="group" aria-label="Corrin gender">
            <button type="button" aria-pressed={vm.gender === 'male'} onClick={() => vm.onSetGender('male')}>
              Male
            </button>
            <button type="button" aria-pressed={vm.gender === 'female'} onClick={() => vm.onSetGender('female')}>
              Female
            </button>
          </div>
        </div>
      </header>
      <div className="corrinrow">
        <span className="corrinlabel">Boon</span>
        <div className="scroller">
          {vm.boons.map((boon) => (
            <ChipButton key={boon.key} active={boon.active} variant="accent" onClick={boon.onSelect}>
              {boon.label}
            </ChipButton>
          ))}
        </div>
      </div>
      <div className="corrinrow">
        <span className="corrinlabel">Bane</span>
        <div className="scroller">
          {vm.banes.map((bane) => (
            <ChipButton key={bane.key} active={bane.active} variant="warn" onClick={bane.onSelect}>
              {bane.label}
            </ChipButton>
          ))}
        </div>
      </div>
      <div className="corrinrow">
        <span className="corrinlabel">Talent</span>
        <button type="button" className="chipbtn" onClick={vm.onOpenTalent}>
          <Chip variant="accent">{vm.talent} ▾</Chip>
        </button>
        <span className="corrinlabel">Spouse</span>
        <button type="button" className="chipbtn" onClick={vm.onOpenSpouse}>
          <Chip variant="accent">{vm.spouse} ▾</Chip>
        </button>
      </div>
      <span className="muted childline">Child: {vm.childName} · appears automatically with Corrin's pairing</span>
    </article>
  )
}
