import test from 'ava'
import { execSync } from 'child_process'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

import { getLatestPatches } from '../index.js'

test('getLatestPatches returns the most recent patches', (t) => {
  // Setup a temporary Pijul repository
  const dir = mkdtempSync(join(tmpdir(), 'pijul-test-'))
  
  try {
    execSync('pijul init', { cwd: dir })
    execSync('touch a.txt', { cwd: dir })
    execSync('pijul add a.txt', { cwd: dir })
    execSync('pijul record -am "test message 1"', { cwd: dir, stdio: 'ignore' })
    execSync('touch b.txt', { cwd: dir })
    execSync('pijul add b.txt', { cwd: dir })
    execSync('pijul record -am "test message 2"', { cwd: dir, stdio: 'ignore' })
    
    // Get latest 2 patches
    const latest = getLatestPatches(dir, "main", 2, undefined)
    
    t.truthy(latest)
    t.true(Array.isArray(latest))
    t.is(latest.length, 2)
    t.is(typeof latest[0], 'string')
    t.truthy(latest[0].length > 0)
    t.is(typeof latest[1], 'string')
    t.truthy(latest[1].length > 0)
    
    // Get patches since the second patch (which should only return the third patch)
    const sincePatch = latest[1] // This is the older patch of the two (test message 1)
    const latestSince = getLatestPatches(dir, "main", undefined, sincePatch)
    t.true(Array.isArray(latestSince))
    t.is(latestSince.length, 1)
    t.is(latestSince[0], latest[0]) // It should just return the most recent one
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
