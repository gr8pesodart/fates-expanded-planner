import { Fragment } from 'react'
import { usePlanner } from '../app/plannerContext'
import type { UnitDef } from '../data/types'
import { displayName } from '../logic/army'
import type { AccessNotice, RelationChange, SkillAccess } from '../logic/skillAccess'
import { Portrait } from './art'
import { Icon } from './icons'
import { ItemIcon } from './ItemIcon'
import { bookItemKey } from '../data/itemIcons'

/**
 * The inset under a skill card saying how the plan could reach the skill (Figma 3:4348). Tones rise
 * with the distance (owner, v3.4): blue for a class the unit has but doesn't take, yellow for one
 * that needs inheriting or another relationship, red for one nothing in the run gives. Where the
 * skill is learned is the card's tag, not part of the notice. The picker's Grouped view shows one
 * grey notice per class (`perClass`) and only when the group heading doesn't already say it all.
 * `whose`: the plan in question is someone else's (the inherit picker: "Not in Corrin's progression").
 */
export function SkillNotice({ access, grey = false, corrin = false, perClass = false, whose }: { access: AccessNotice; grey?: boolean; corrin?: boolean; perClass?: boolean; whose?: string }) {
  const { run } = usePlanner()
  if (access.group === 'progression') return null
  if (perClass && (access.group === 'available' || access.group === 'unavailable')) return null
  const tone = grey ? 'grey' : access.group === 'available' ? 'info' : access.group === 'unavailable' ? 'bad' : 'warn'
  const names = (units: UnitDef[]) => units.map((unit, index) => (
    <Fragment key={unit.id}>{index === 0 ? '' : index === units.length - 1 ? ' or ' : ', '}<strong>{displayName(unit, run)}</strong></Fragment>
  ))
  if (access.group === 'inheritable') {
    return (
      <span className="skill-notice" data-tone={tone}>
        <span className="skill-notice-lead">
          <Icon name="alertCircle" size={16} className="skill-notice-icon" />
          <span>{perClass ? 'Skills can only be inherited from ' : 'Only inheritable from '}{names(access.inheritFrom)}</span>
        </span>
      </span>
    )
  }
  const roleLabel = (change: RelationChange) => change.role === 's' ? 'S' : change.role === 'parent' ? 'Parent' : corrin ? 'A' : 'A+'
  const faces: { label: string; units: UnitDef[] }[] = access.group === 'locked' ? [
    { label: 'Via S Rank', units: access.viaS },
    { label: corrin ? 'Via A Rank' : 'Via A+ Rank', units: access.viaA },
    { label: 'Via Parent', units: access.viaParent },
  ].filter((item) => item.units.length) : []
  // A parent already listed as a way in passes the class's skills on as a matter of course.
  const alsoFrom = access.inheritFrom.filter((parent) => !access.viaParent.includes(parent)
    && !access.viaCombo.some((combo) => combo.some((change) => change.role === 'parent' && change.unit === parent)))
  const bookKey = access.book && 'skillId' in access ? bookItemKey((access as SkillAccess).skillId) : undefined
  // Grouped › Requires support: the heading says it, so the ways in move up.
  const lead = perClass ? null : access.group === 'available' ? (whose ? `Not in ${whose}'s progression` : 'Not in progression') : access.group === 'locked' ? 'Requires support' : 'Not accessible'
  if (!lead && !faces.length && !access.viaCombo.length && !alsoFrom.length) return null
  return (
    <span className="skill-notice" data-tone={tone}>
      {lead ? (
        <span className="skill-notice-lead">
          <Icon name="alertCircle" size={16} className="skill-notice-icon" />
          <span>{lead}</span>
        </span>
      ) : null}
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
      {access.book && !perClass ? (
        <span className="skill-notice-inherit skill-notice-book">
          {bookKey ? <ItemIcon itemKey={bookKey} /> : null}
          From its skill book (DLC)
        </span>
      ) : null}
      {alsoFrom.length ? (
        <span className="skill-notice-inherit">
          {perClass ? 'Skills can also be inherited from ' : 'Can also be inherited from '}{names(alsoFrom)}
        </span>
      ) : null}
    </span>
  )
}

/** Red: an equipped skill this one can't be used with (the stat Takers). */
export function ConflictNotice({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <span className="skill-notice" data-tone="bad">
      <span className="skill-notice-lead">
        <Icon name="alertCircle" size={16} className="skill-notice-icon" />
        <span>Not compatible with equipped {names.map((name, index) => (
          <Fragment key={name}>{index === 0 ? '' : index === names.length - 1 ? ' and ' : ', '}<strong>{name}</strong></Fragment>
        ))}</span>
      </span>
    </span>
  )
}
