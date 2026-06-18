import puppeteer from 'puppeteer'

export function launchBrowser() {
  return puppeteer.launch({
    headless: process.env.HEADFUL ? false : 'new',
    args: ['--no-sandbox', '--ignore-certificate-errors'],
    protocolTimeout: 45000,
  })
}

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
}
