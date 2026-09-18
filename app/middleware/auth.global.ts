import { sentenceFor } from '~/utils/errors'
import { isPublicPath } from '~/utils/routes'

export default defineNuxtRouteMiddleware(async (to) => {
  if (isPublicPath(to.path)) return
  const { resolve } = useSession()
  try {
    if (await resolve()) return
  } catch (error) {
    // Not a refusal — the cloud did not answer at all. `allowed_origins` unset
    // is the usual cause on a fresh clone, and the browser drops the answer
    // before this code sees it, leaving a raw `TypeError: Failed to fetch`.
    // Without this catch that string is what the error page prints.
    return showError({ statusCode: 503, statusMessage: sentenceFor(error) })
  }
  return navigateTo({ path: '/auth/login', query: to.fullPath === '/' ? {} : { next: to.fullPath } })
})
