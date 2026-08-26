import { chromium } from 'playwright'

const outDir = 'C:/Users/mirza/AppData/Local/Temp/claude/c--Users-mirza-OneDrive-Desktop-Projects-Insightder/82626e25-03eb-45a9-82a1-e4b4719b5f62/scratchpad'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto('http://localhost:5173/login')
await page.screenshot({ path: `${outDir}/ui-01-login.png` })

await page.fill('#username', 'admin')
await page.fill('#password', 'admin123')
await page.click('button[type=submit]')

await page.waitForSelector('text=Mentor-Mentee Insights')
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/ui-02-dashboard.png`, fullPage: true })

await page.click('a:has-text("Students")')
await page.waitForSelector('text=Students')
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/ui-03-students.png`, fullPage: true })

// click first student row
const firstStudentLink = page.locator('table a').first()
await firstStudentLink.click()
await page.waitForSelector('text=Session History')
await page.waitForTimeout(300)
await page.screenshot({ path: `${outDir}/ui-04-student-profile.png`, fullPage: true })

// click first session
await page.locator('a[href^="/analyses/"]').first().click()
await page.waitForSelector('text=Insights')
await page.waitForTimeout(300)
await page.screenshot({ path: `${outDir}/ui-05-analysis-view.png`, fullPage: true })

await page.click('button:has-text("Transcript")')
await page.waitForTimeout(200)
await page.screenshot({ path: `${outDir}/ui-06-transcript-tab.png`, fullPage: true })

await page.click('a:has-text("New Analysis")')
await page.waitForSelector('text=Session details')
await page.waitForTimeout(300)
await page.screenshot({ path: `${outDir}/ui-07-new-analysis.png`, fullPage: true })

console.log('Console/page errors:', JSON.stringify(errors))
await browser.close()
