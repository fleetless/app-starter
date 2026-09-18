import { isPublicPath } from '~/utils/routes'

export default defineNuxtRouteMiddleware(async (to) => {
  if (isPublicPath(to.path)) return
  const { resolve } = useSession()
  if (await resolve()) return
  return navigateTo({ path: '/auth/login', query: to.fullPath === '/' ? {} : { next: to.fullPath } })
})
