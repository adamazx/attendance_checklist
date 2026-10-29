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
