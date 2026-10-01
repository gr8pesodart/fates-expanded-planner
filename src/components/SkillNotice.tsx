import { usePlanner } from '../app/plannerContext'
import type { UnitDef } from '../data/types'
import { displayName } from '../logic/army'
import { classFamily } from '../logic/classes'
import type { RelationChange, SkillAccess } from '../logic/skillAccess'
import { Portrait } from './art'
import { Icon } from './icons'

/**
 * The inset under a skill card saying why the plan doesn't reach the skill (Figma 3:4348): yellow
 * for a class the unit has but doesn't take, red for one that needs another relationship. The
 * skill picker shows one grey notice per class heading (`perClass`: no level), since its group
 * headings already say it.
 */
export function SkillNotice({ access, grey = false, corrin = false, perClass = false }: { access: SkillAccess; grey?: boolean; corrin?: boolean; perClass?: boolean }) {
  const { dataset, run } = usePlanner()
  if (access.group === 'progression') return null
  const def = access.classId !== null ? dataset.classesById.get(access.classId) : undefined
  const where = def ? `${classFamily(def.name)}${access.level !== null && !perClass ? ` Lv ${access.level}` : ''}` : null
  const roleLabel = (change: RelationChange) => change.role === 's' ? 'S' : change.role === 'parent' ? 'Parent' : corrin ? 'A' : 'A+'
  const names = (units: UnitDef[]) => units.map((unit) => displayName(unit, run)).join(', ')
  const tone = grey ? 'grey' : access.group === 'locked' ? 'bad' : 'warn'
  // The picker's compact form (owner): "Only inheritable from Ryoma: Sky Knight Lv 1".
  if (grey && access.group === 'inheritable') {
    return (
      <span className="skill-notice" data-tone={tone}>
        <span className="skill-notice-lead">
          <Icon name="alertCircle" size={16} className="skill-notice-icon" />
          <span>Only inheritable from <strong>{names(access.inheritFrom)}</strong>{where ? <>: <strong>{where}</strong></> : null}</span>
        </span>
      </span>
    )
  }
  const lead = access.group === 'available' ? 'Not in progression'
    : access.group === 'inheritable' ? 'Only inheritable'
      : 'Not accessible'
  const faces: { label: string; units: UnitDef[] }[] = access.group === 'locked' ? [
    { label: 'Via S Rank', units: access.viaS },
    { label: corrin ? 'Via A Rank' : 'Via A+ Rank', units: access.viaA },
    { label: 'Via Parent', units: access.viaParent },
  ].filter((item) => item.units.length) : []
  return (
    <span className="skill-notice" data-tone={tone}>
      <span className="skill-notice-lead">
        <Icon name="alertCircle" size={16} className="skill-notice-icon" />
        <span>{lead}{where ? <>: <strong>{where}</strong></> : null}</span>
      </span>
      {faces.length ? (
        <span className="skill-notice-ways">
          {faces.map((item) => (
            <span key={item.label} className="skill-notice-way">
              <em>{item.label}:</em>
              <span className="skill-notice-faces">
                {item.units.map((unit) => <Portrait key={unit.id} unitId={unit.id} name={displayName(unit, run)} className="notice-face" />)}
              </span>
            </span>
          ))}
        </span>
      ) : null}
      {access.viaCombo.length ? (
        <span className="skill-notice-combos">
          <em>Only together:</em>
          {access.viaCombo.slice(0, 6).map((combo) => (
            <span key={combo.map((change) => `${change.role}:${change.unit.id}`).join('+')} className="skill-notice-combo">
              {combo.map((change, index) => (
                <span key={`${change.role}:${change.unit.id}`}>
                  {index ? ' & ' : ''}{roleLabel(change)} <strong>{displayName(change.unit, run)}</strong>
                </span>
              ))}
            </span>
          ))}
          {access.viaCombo.length > 6 ? <span>+{access.viaCombo.length - 6} more</span> : null}
        </span>
      ) : null}
      {access.inheritFrom.length ? (
        <span className="skill-notice-inherit">
          {access.group === 'inheritable' ? 'Inherit from ' : 'Can be inherited from '}<strong>{names(access.inheritFrom)}</strong>
        </span>
      ) : null}
    </span>
  )
}
