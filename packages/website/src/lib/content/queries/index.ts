import { getCollection } from 'astro:content'
import {
  countEntriesByCategory,
  selectFeaturedEntries,
  selectFeaturedProjects,
  selectOtherProjects,
  selectProjectsByKind,
  selectUnfeaturedEntries,
  sortEntriesNewestFirst,
  sortProjects,
} from '../selectors'

export const getEntryIndex = async () => {
  const entries = sortEntriesNewestFirst(await getCollection('entries'))

  return {
    entries,
    featuredEntries: selectFeaturedEntries(entries),
    otherEntries: selectUnfeaturedEntries(entries),
    counts: countEntriesByCategory(entries),
  }
}

export const getProjectIndex = async () => {
  const projects = sortProjects(await getCollection('projects'))
  const softwareProjects = selectProjectsByKind(projects, 'software')
  const physicalProjects = selectProjectsByKind(projects, 'physical')

  return {
    projects,
    softwareProjects,
    physicalProjects: selectOtherProjects(physicalProjects),
    featuredProjects: selectFeaturedProjects(projects),
    otherSoftwareProjects: selectOtherProjects(softwareProjects),
  }
}
