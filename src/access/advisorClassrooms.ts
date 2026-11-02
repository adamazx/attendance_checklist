import type { PayloadRequest } from 'payload'

/**
 * Resolve the classroom IDs an advisor is assigned to, by querying Classroom
 * where `advisors` contains the current user. This is the reliable way to scope
 * records that sit one relationship away (e.g. Student -> Classroom -> advisors),
 * rather than a fragile nested-relationship `where` clause.
 *
 * Returns an empty array for an unauthenticated request or an advisor with no
 * assigned classrooms — callers use it as `{ <rel>: { in: ids } }`, and an empty
 * `in` matches nothing, which is the safe default (see no classrooms -> see nothing).
 */
export const advisorClassroomIds = async (
  req: PayloadRequest,
): Promise<(string | number)[]> => {
  const user = req.user
  if (!user) return []

  const result = await req.payload.find({
    collection: 'classrooms',
    where: { advisors: { in: [user.id] } },
    // Explicit: this internal lookup must bypass classroomRead to resolve the
    // user's own classrooms; the `where` filter already constrains to them.
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  })

  return result.docs.map((doc) => doc.id)
}

/**
 * The subset of the advisor's classrooms that belong to an active academic year —
 * the only classrooms an advisor may write attendance for. Past-year classrooms stay
 * readable (advisorClassroomIds) but are read-only. Empty when nothing is active.
 */
export const advisorActiveClassroomIds = async (
  req: PayloadRequest,
): Promise<(string | number)[]> => {
  const assigned = await advisorClassroomIds(req)
  if (assigned.length === 0) return []

  // Explicit overrideAccess: internal lookups; the `where` clauses constrain them.
  const years = await req.payload.find({
    collection: 'academic-years',
    where: { isActive: { equals: true } },
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  })
  if (years.docs.length === 0) return []

  const result = await req.payload.find({
    collection: 'classrooms',
    where: {
      and: [{ id: { in: assigned } }, { academicYear: { in: years.docs.map((y) => y.id) } }],
    },
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  })

  return result.docs.map((doc) => doc.id)
}
