import { describe, expect, it } from 'vitest'
import { nextRadio, radioStep } from './radio'

describe('radioStep', () => {
  it('moves with the arrow in left-to-right pages', () => {
    expect(radioStep('ArrowRight', false)).toBe(1)
    expect(radioStep('ArrowLeft', false)).toBe(-1)
  })

  it('flips left and right in right-to-left pages', () => {
    expect(radioStep('ArrowRight', true)).toBe(-1)
    expect(radioStep('ArrowLeft', true)).toBe(1)
  })

  it('down is forward and up is back in both', () => {
    expect(radioStep('ArrowDown', true)).toBe(1)
    expect(radioStep('ArrowUp', false)).toBe(-1)
  })

  it('ignores every other key', () => {
    expect(radioStep('Enter', false)).toBe(0)
    expect(radioStep('a', true)).toBe(0)
  })
})

describe('nextRadio', () => {
  const values = ['sa', 'intl']

  it('steps and wraps around', () => {
    expect(nextRadio(values, 'sa', 1)).toBe('intl')
    expect(nextRadio(values, 'intl', 1)).toBe('sa')
    expect(nextRadio(values, 'sa', -1)).toBe('intl')
  })

  it('starts from the first when the current one is unknown', () => {
    expect(nextRadio(values, 'x', 1)).toBe('intl')
  })
})
