export interface FollowPoint {
  x: number;
  z: number;
}

/** Add a player position to the breadcrumb path without growing an unbounded
 * array. Tiny camera/player jitter is deliberately ignored. */
export function appendFollowerPoint(
  trail: FollowPoint[], point: FollowPoint, minStep = 0.075, maxPoints = 96,
): void {
  const last = trail[trail.length - 1];
  if (last && Math.hypot(point.x - last.x, point.z - last.z) < minStep) return;
  trail.push({ x: point.x, z: point.z });
  if (trail.length > maxPoints) trail.splice(0, trail.length - maxPoints);
}

/** Locate a point a fixed travelled distance behind the newest breadcrumb.
 * Following the path rather than drawing a straight line to the player keeps
 * the companion on the same side of walls and tight street corners. */
export function followerPointBehind(
  trail: readonly FollowPoint[], distance: number, out: FollowPoint,
): FollowPoint {
  if (trail.length === 0) return out;
  if (trail.length === 1 || distance <= 0) {
    out.x = trail[trail.length - 1].x;
    out.z = trail[trail.length - 1].z;
    return out;
  }

  let remaining = distance;
  for (let i = trail.length - 1; i > 0; i--) {
    const newer = trail[i];
    const older = trail[i - 1];
    const segment = Math.hypot(newer.x - older.x, newer.z - older.z);
    if (segment < 0.0001) continue;
    if (remaining <= segment) {
      const ratio = remaining / segment;
      out.x = newer.x + (older.x - newer.x) * ratio;
      out.z = newer.z + (older.z - newer.z) * ratio;
      return out;
    }
    remaining -= segment;
  }

  out.x = trail[0].x;
  out.z = trail[0].z;
  return out;
}

