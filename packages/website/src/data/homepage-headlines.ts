export interface HomepageHeadline {
  readonly emphasis: string
  readonly lead: string
}

export const homepageHeadlines = [
  {
    lead: 'This is where I keep ',
    emphasis:
      'things I’ve made, notes I’ve written, and ideas I’m not done with.',
  },
  { lead: 'I make things, ', emphasis: 'then write down what happened.' },
  {
    lead: 'My corner of the internet for ',
    emphasis: 'software, side projects, photos, and useful detours.',
  },
  {
    lead: 'Things I’ve built ',
    emphasis: 'and what I learned after living with them.',
  },
  {
    lead: 'I put things here ',
    emphasis: 'before I forget why they mattered.',
  },
  { lead: 'Notes from ', emphasis: 'making things and changing my mind.' },
  {
    lead: 'What I’m working on, ',
    emphasis: 'what I noticed, and what I want to remember.',
  },
  {
    lead: 'A place for ',
    emphasis:
      'useful work, unfinished notes, and things I keep coming back to.',
  },
  {
    lead: 'I build software, take photos, ',
    emphasis: 'and occasionally print small pieces of plastic.',
  },
  {
    lead: 'Things I’ve made ',
    emphasis: 'plus the notes I needed while making them.',
  },
  { lead: 'I have too many interests, so ', emphasis: 'they share a website.' },
  {
    lead: 'Mostly software and notes, ',
    emphasis: 'with some books, films, and side quests.',
  },
  {
    lead: 'I make software ',
    emphasis: 'and keep track of what actually worked.',
  },
  { lead: 'Work in progress, ', emphasis: 'notes included.' },
  {
    lead: 'Projects, notes, ',
    emphasis: 'and whatever sent me down a rabbit hole this week.',
  },
  {
    lead: 'I write things down ',
    emphasis: 'because I know I’ll forget the details.',
  },
  {
    lead: 'A small place for ',
    emphasis: 'work, interests, and the occasional tangent.',
  },
  {
    lead: 'This is where ',
    emphasis: 'the things I care about stop living only in my head.',
  },
  { lead: 'I make things ', emphasis: 'and leave notes for the next attempt.' },
  {
    lead: 'Work, notes, ',
    emphasis: 'and a few things that do not fit neatly anywhere.',
  },
  { lead: 'A collection of drafts, ', emphasis: 'some of them almost final.' },
  { lead: 'I keep coming back to things, ', emphasis: 'but it’s not a loop.' },
  { lead: 'Things I’ve built and ', emphasis: 'the drafts that got me there.' },
  { lead: 'A canvas of ', emphasis: 'what I managed to leave behind.' },
  { lead: 'Notes from ', emphasis: 'a world still being painted.' },
] as const satisfies readonly HomepageHeadline[]

export const homepageEasterEggHeadlines = [
  { lead: '', emphasis: 'For those who come after.' },
] as const satisfies readonly HomepageHeadline[]
