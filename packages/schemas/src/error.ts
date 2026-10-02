import { z } from 'zod'

// HTTP error response
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// Structured diagnostics for a payload that broke its contract. Only the
// location and the kind of each issue are kept: Zod messages and the offending
// values are left out so invites, sessions and other payload data never reach a log.
export type ContractIssue = {
  path: string
  code: string
}

type ZodIssue = z.core.$ZodIssue

// A union only says "no branch matched"; the useful location is inside its branches.
function flattenIssue(issue: ZodIssue, parentPath: PropertyKey[]): ContractIssue[] {
  const path = [...parentPath, ...issue.path]
  if (issue.code === 'invalid_union' && issue.errors.length > 0) {
    return issue.errors.flatMap((branch) => branch.flatMap((nested) => flattenIssue(nested, path)))
  }
  return [{ path: path.map(String).join('.'), code: issue.code }]
}

export function describeContractIssues(error: z.ZodError): ContractIssue[] {
  const unique = new Map<string, ContractIssue>()
  for (const issue of error.issues.flatMap((issue) => flattenIssue(issue, []))) {
    unique.set(`${issue.path}:${issue.code}`, issue)
  }
  return [...unique.values()]
}
