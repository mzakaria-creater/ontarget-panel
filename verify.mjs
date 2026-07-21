import { chromium } from 'playwright'

const routes = ['/monitor', '/smslive', '/recovery', '/wallets', '/settings']
const base = 'http://localhost:5173'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext()
const page = await context.newPage()

const allErrors = []
page.on('pageerror', (err) => allErrors.push(`[pageerror] ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') allErrors.push(`[console] ${msg.text()}`)
})

for (const route of routes) {
  allErrors.length = 0
  await page.goto(base + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const dir = await page.evaluate(() => document.documentElement.dir)
  const title = await page.textContent('h1').catch(() => null)
  const shot = `/private/tmp/claude-501/-Users-mz/2e2fe26f-ba0f-48be-a176-abfca9408ef3/scratchpad/screenshot${route.replace(/\//g, '_')}.png`
  await page.screenshot({ path: shot })
  console.log(`\n=== ${route} ===`)
  console.log('dir:', dir, '| h1:', title)
  console.log('screenshot:', shot)
  if (allErrors.length) {
    console.log('ERRORS:')
    allErrors.forEach((e) => console.log(' ', e))
  } else {
    console.log('no console/page errors')
  }
}

await browser.close()
