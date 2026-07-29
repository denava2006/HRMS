import fs from 'node:fs'

const f = 'src/contexts/AuthContext.tsx'
let t = fs.readFileSync(f, 'utf8')

// The file stores the apostrophe as a literal ’ escape sequence.
const MSG = String.raw`'That email and password combination doesn’t match our records.'`

const old =
  '    // "Authentication Success?" — No branch: Supabase rejects the credentials.\n' +
  '    const { data, error } = await supabase.auth.signInWithPassword({ email, password })\n' +
  '    if (error) {\n' +
  `      return { error: ${MSG} }\n` +
  '    }'

if (!t.includes(old)) {
  // Fall back to matching just the error branch.
  const shortOld = '    if (error) {\n' + `      return { error: ${MSG} }\n` + '    }'
  if (!t.includes(shortOld)) {
    console.error('MISS — neither form matched')
    process.exit(1)
  }
  t = t.replace(shortOld, buildNew())
} else {
  t = t.replace(old, '    const { data, error } = await supabase.auth.signInWithPassword({ email, password })\n' + buildNew())
}

fs.writeFileSync(f, t)
console.log('patched')

function buildNew() {
  const UNREACHABLE = String.raw`'Can’t reach the server. Check that Supabase is running (supabase start) and that VITE_SUPABASE_URL is correct.'`
  return [
    '    if (error) {',
    '      // Reporting every failure as "wrong password" sends people hunting for',
    "      // a typo when the real problem is that the backend isn't reachable --",
    "      // the Supabase stack isn't running, or VITE_SUPABASE_URL points",
    '      // somewhere dead. Those need very different fixes, so they say so.',
    '      const status = (error as { status?: number }).status',
    '      const isUnreachable =',
    '        status === undefined || status === 0 || status >= 500 || /fetch|network/i.test(error.message)',
    '',
    '      if (isUnreachable) {',
    `        return { error: ${UNREACHABLE} }`,
    '      }',
    `      return { error: ${MSG} }`,
    '    }',
  ].join('\n')
}
