import { describe, expect, it, vi } from 'vitest'
import { applyJointState } from '~/utils/joint-states'

const joints = () => ({
  a: { setJointValue: vi.fn() },
  b: { setJointValue: vi.fn() }
})

describe('applyJointState', () => {
  it('sets each named joint and returns what it applied', () => {
    const j = joints()
    expect(applyJointState(j, { name: ['a', 'b'], position: [0.5, -1] })).toEqual({ a: 0.5, b: -1 })
    expect(j.a.setJointValue).toHaveBeenCalledWith(0.5)
    expect(j.b.setJointValue).toHaveBeenCalledWith(-1)
  })

  it('skips unknown names and applies the rest', () => {
    const j = joints()
    expect(applyJointState(j, { name: ['x', 'a'], position: [1, 2] })).toEqual({ a: 2 })
    expect(j.a.setJointValue).toHaveBeenCalledWith(2)
  })

  it('pairs only up to the shorter array', () => {
    const j = joints()
    expect(applyJointState(j, { name: ['a', 'b'], position: [0.3] })).toEqual({ a: 0.3 })
    expect(j.b.setJointValue).not.toHaveBeenCalled()
  })

  it('skips non-finite and non-numeric positions', () => {
    const j = joints()
    expect(applyJointState(j, { name: ['a', 'b', 'a'], position: [Number.NaN, '1', Infinity] })).toEqual({})
    expect(j.a.setJointValue).not.toHaveBeenCalled()
    expect(j.b.setJointValue).not.toHaveBeenCalled()
  })

  it('answers nothing for malformed messages and never throws', () => {
    const j = joints()
    for (const message of [null, 42, {}, { name: 'a', position: 1 }]) {
      expect(applyJointState(j, message)).toEqual({})
    }
    expect(j.a.setJointValue).not.toHaveBeenCalled()
  })

  it('ignores extra keys of a JointState message', () => {
    const j = joints()
    expect(applyJointState(j, { header: {}, name: ['a'], position: [1], velocity: [9], effort: [9] })).toEqual({ a: 1 })
  })
})
