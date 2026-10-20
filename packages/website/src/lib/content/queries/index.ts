import { getCollection } from 'astro:content'
import { isTranslatedEntry } from '../../../features/articles/translations'
import { getPublishedCmsEntries, mergePublicEntries } from '../../cms/entries'
import { cmsOwnsEntries, cmsTrialEnabled } from '../../cms/mode'
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
  const files = cmsOwnsEntries ? [] : await getCollection('entries')
  const merged = cmsTrialEnabled
    ? mergePublicEntries(files, await getPublishedCmsEntries())
    : files
  const entries = sortEntriesNewestFirst(merged.filter(entry => !isTranslatedEntry(entry)))

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
