import type { ProjectKind } from '../../../content/schemas'
import { getProjectHref as getProjectRoute } from '../../routes'
import { orderByUniqueRank } from './ordering'
import type { ProjectRecord } from './types'

export function sortProjects<T extends ProjectRecord>(projects: readonly T[]) {
  return orderByUniqueRank(projects, (project) => project.data.order, 'project order')
}

export function selectProjectsByKind<T extends ProjectRecord>(
  projects: readonly T[],
  kind: ProjectKind,
) {
  return projects.filter((project) => project.data.kind === kind)
}

export function selectFeaturedProjects<T extends ProjectRecord>(projects: readonly T[]) {
  const featured = projects.filter(
    (project): project is T & { data: T['data'] & { featuredOrder: number } } =>
      project.data.featuredOrder !== undefined,
  )

  return orderByUniqueRank(featured, (project) => project.data.featuredOrder, 'project featuredOrder')
}

export function selectOtherProjects<T extends ProjectRecord>(projects: readonly T[]) {
  return sortProjects(projects).filter((project) => project.data.featuredOrder === undefined)
}

export function getProjectHref(project: ProjectRecord) {
  return project.data.externalUrl ?? getProjectRoute(project.id)
}

export function isExternalProject(project: ProjectRecord) {
  return Boolean(project.data.externalUrl)
}

export function formatTechnologies(project: ProjectRecord) {
  return project.data.technologies?.join(' / ') ?? ''
}
