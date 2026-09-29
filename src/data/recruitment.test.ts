import { describe, expect, it } from 'vitest'
import { sortRoster } from '../logic/rosterSort'
import classesData from './packs/ugf-2.5.2/classes.json'
import recruitment from './packs/ugf-2.5.2/recruitment.json'
import unitsData from './packs/ugf-2.5.2/units.json'

const ROUTES = ['birthright', 'conquest', 'revelation'] as const
type RouteName = (typeof ROUTES)[number]

const unitById = new Map(unitsData.units.map((u) => [u.id, u]))
const classById = new Map(classesData.classes.map((c) => [c.id, c]))

function idOf(name: string): string {
  const unit = unitsData.units.find((u) => u.name === name)
  if (!unit) throw new Error(`unit ${name} not in pack`)
  return unit.id
}

function rows(route: RouteName) {
  return recruitment.routes[route]
}

function indexOf(route: RouteName, name: string): number {
  return rows(route).findIndex((row) => row.unit === idOf(name))
}

describe('ugf-2.5.2 recruitment pack', () => {
  it('numbers each route 0..n-1 without duplicate units', () => {
    for (const route of ROUTES) {
      const routeRows = rows(route)
      expect(routeRows.length).toBeGreaterThan(0)
      expect(routeRows.map((row) => row.order)).toEqual(routeRows.map((_, i) => i))
      expect(new Set(routeRows.map((row) => row.unit)).size).toBe(routeRows.length)
    }
  })

  it('resolves every unit, route and join class', () => {
    for (const route of ROUTES) {
      for (const row of rows(route)) {
        const unit = unitById.get(row.unit)
        expect(unit, `${row.unit} in units.json`).toBeDefined()
        expect(unit!.routes).toContain(route)

        const cls = classById.get(row.joinClassId)
        expect(cls, `${row.unit} join class ${row.joinClassId}`).toBeDefined()
        if (cls!.name.endsWith(' (M)')) expect(unit!.gender).toBe('male')
        if (cls!.name.endsWith(' (F)')) expect(unit!.gender).toBe('female')
        expect([...unit!.classes, ...unit!.reclasses]).toContain(row.joinClassId)
      }
    }
  })

  it('puts Corrin (M) and Corrin (F) first on every route', () => {
    for (const route of ROUTES) {
      expect(rows(route).slice(0, 2).map((row) => row.unit)).toEqual([
        idOf('Corrin (M)'),
        idOf('Corrin (F)'),
      ])
      expect(rows(route)[0].joinLevel).toBe(1)
      expect(rows(route)[1].joinLevel).toBe(1)
    }
  })

  it('keeps Gunter out of Birthright but in Conquest and Revelation', () => {
    expect(indexOf('birthright', 'Gunter')).toBe(-1)
    expect(indexOf('conquest', 'Gunter')).toBeGreaterThanOrEqual(0)
    expect(indexOf('revelation', 'Gunter')).toBeGreaterThanOrEqual(0)
  })

  it('keeps Yukimura Birthright-only, Izana off Revelation, Fuga Revelation-only', () => {
    expect(indexOf('birthright', 'Yukimura')).toBeGreaterThanOrEqual(0)
    expect(indexOf('conquest', 'Yukimura')).toBe(-1)
    expect(indexOf('revelation', 'Yukimura')).toBe(-1)

    expect(indexOf('birthright', 'Izana')).toBeGreaterThanOrEqual(0)
    expect(indexOf('conquest', 'Izana')).toBeGreaterThanOrEqual(0)
    expect(indexOf('revelation', 'Izana')).toBe(-1)

    expect(indexOf('birthright', 'Fuga')).toBe(-1)
    expect(indexOf('conquest', 'Fuga')).toBe(-1)
    expect(indexOf('revelation', 'Fuga')).toBeGreaterThanOrEqual(0)
  })

  it('orders Kaze before Felicia/Jakob in Birthright but after them in Conquest', () => {
    const kaze = indexOf('birthright', 'Kaze')
    expect(kaze).toBeGreaterThanOrEqual(0)
    expect(kaze).toBeLessThan(indexOf('birthright', 'Felicia'))
    expect(kaze).toBeLessThan(indexOf('birthright', 'Jakob'))

    const kazeCq = indexOf('conquest', 'Kaze')
    expect(kazeCq).toBeGreaterThan(indexOf('conquest', 'Felicia'))
    expect(kazeCq).toBeGreaterThan(indexOf('conquest', 'Jakob'))
  })

  it('places Mozu at her paralogue position, not at the end', () => {
    const before: Record<RouteName, string> = {
      birthright: 'Orochi',
      conquest: 'Effie',
      revelation: 'Gunter',
    }
    const after: Record<RouteName, string> = {
      birthright: 'Hinoka',
      conquest: 'Odin',
      revelation: 'Sakura',
    }
    for (const route of ROUTES) {
      const mozu = indexOf(route, 'Mozu')
      expect(mozu).toBeGreaterThanOrEqual(0)
      expect(rows(route)[mozu].chapter).toBe('Paralogue 1')
      expect(rows(route)[mozu].optional).toBe(true)
      expect(mozu).toBeGreaterThan(indexOf(route, before[route]))
      expect(mozu).toBeLessThan(indexOf(route, after[route]))
      expect(mozu).toBeLessThan(rows(route).length - 1)
    }
  })

  it('leaves children trailing first-gen units in paralogue order', () => {
    for (const route of ROUTES) {
      const children = rows(route).filter((row) => unitById.get(row.unit)!.fixedParent !== null)
      expect(children.length).toBeGreaterThan(0)
      for (const child of children) {
        expect(child.optional).toBe(true)
        expect(child.joinLevel).toBe(10)
        expect(child.chapter).toMatch(/^Paralogue \d+$/)
      }
      const paraNumbers = children.map((row) => Number(row.chapter.replace('Paralogue ', '')))
      expect(paraNumbers).toEqual([...paraNumbers].sort((a, b) => a - b))

      const entries = rows(route).map((row) => {
        const unit = unitById.get(row.unit)!
        return {
          unitId: row.unit,
          name: unit.name,
          favourite: false,
          recruitIndex: row.order,
          fixedParent: unit.fixedParent,
          lensRow: [],
        }
      })
      const sorted = sortRoster(entries, { kind: 'recruit' })
      const firstChild = sorted.findIndex((entry) => entry.fixedParent !== null)
      expect(firstChild).toBeGreaterThan(-1)
      expect(sorted.slice(firstChild).every((entry) => entry.fixedParent !== null)).toBe(true)
      expect(sorted.slice(firstChild).map((entry) => entry.unitId)).toEqual(
        children.map((row) => row.unit),
      )
    }
  })

  it('pins join levels and classes for the promoted edge cases', () => {
    const find = (route: RouteName, name: string) =>
      rows(route).find((row) => row.unit === idOf(name))!
    expect(find('birthright', 'Ryoma')).toMatchObject({ joinLevel: 4, joinClassId: 31 })
    expect(find('birthright', 'Reina')).toMatchObject({ joinLevel: 1, joinClassId: 62 })
    expect(find('birthright', 'Felicia')).toMatchObject({ joinLevel: 1, joinClassId: 94 })
    expect(find('conquest', 'Gunter')).toMatchObject({ joinLevel: 10, joinClassId: 11 })
    expect(find('conquest', 'Shura')).toMatchObject({ joinLevel: 2, joinClassId: 29 })
    expect(find('revelation', 'Fuga')).toMatchObject({ joinLevel: 10, joinClassId: 35 })
    expect(find('revelation', 'Flora')).toMatchObject({ joinLevel: 5, joinClassId: 94 })
    expect(find('birthright', 'Yukimura')).toMatchObject({ joinLevel: 10, joinClassId: 77 })
    expect(find('conquest', 'Izana')).toMatchObject({ joinLevel: 5, joinClassId: 51 })
  })
})
