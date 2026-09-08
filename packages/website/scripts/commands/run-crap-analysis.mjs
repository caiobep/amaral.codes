#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { collectQualitySources } from '../quality-sources/index.mjs'

const sourceFiles = collectQualitySources()
const executable = process.platform === 'win32' ? 'crap-typescript.cmd' : 'crap-typescript'
const args = [
  '--package-manager', 'npm',
  '--test-runner', 'vitest',
  '--threshold', '6',
  '--format', 'json',
  '--output', 'coverage/crap.json',
  ...sourceFiles,
]
const result = spawnSync(executable, args, { stdio: 'inherit' })

if (result.error) throw result.error
process.exitCode = result.status ?? 1
