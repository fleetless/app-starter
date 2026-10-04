/** The part of a URDF joint that a joint state drives. */
export interface SettableJoint {
  setJointValue(value: number): unknown
}

/**
 * Sets each joint a sensor_msgs/JointState message names, and returns the values it applied.
 * Malformed messages apply nothing; this never throws.
 */
export function applyJointState(joints: Record<string, SettableJoint>, message: unknown): Record<string, number> {
  const applied: Record<string, number> = {}
  if (typeof message !== 'object' || message === null) return applied
  const { name, position } = message as { name?: unknown, position?: unknown }
  if (!Array.isArray(name) || !Array.isArray(position)) return applied
  const count = Math.min(name.length, position.length)
  for (let i = 0; i < count; i++) {
    const joint = name[i]
    const value = position[i]
    if (typeof joint !== 'string' || !Object.hasOwn(joints, joint)) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    joints[joint]!.setJointValue(value)
    applied[joint] = value
  }
  return applied
}
