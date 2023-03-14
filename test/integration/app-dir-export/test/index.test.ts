/* eslint-env jest */

import { join } from 'path'
import { promisify } from 'util'
import fs from 'fs-extra'
import webdriver from 'next-webdriver'
import globOrig from 'glob'
import {
  File,
  nextBuild,
  nextExport,
  startStaticServer,
  stopApp,
  waitFor,
} from 'next-test-utils'

const glob = promisify(globOrig)
const appDir = join(__dirname, '..')
const distDir = join(__dirname, '.next')
const exportDir = join(appDir, 'out')
const nextConfig = new File(join(appDir, 'next.config.js'))
const slugPage = new File(join(appDir, 'app/another/[slug]/page.js'))
const delay = 100

async function runTests({
  trailingSlash,
  dynamic,
}: {
  trailingSlash?: boolean
  dynamic?: string
}) {
  if (trailingSlash) {
    nextConfig.replace(
      'trailingSlash: true,',
      `trailingSlash: ${trailingSlash},`
    )
  }
  if (dynamic) {
    slugPage.replace(
      `const dynamic = 'force-static'`,
      `const dynamic = '${dynamic}'`
    )
  }
  await fs.remove(distDir)
  await fs.remove(exportDir)
  await nextBuild(appDir)
  await nextExport(appDir, { outdir: exportDir })
  const app = await startStaticServer(exportDir)
  const address = app.address()
  const appPort = typeof address !== 'string' ? address.port : 3000

  try {
    const a = (n: number) => `li:nth-child(${n}) a`
    console.log('[navigate]')
    const browser = await webdriver(appPort, '/')
    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(1)).text()).toBe(
      'another no trailingslash'
    )
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit the home page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(2)).text()).toBe(
      'another has trailingslash'
    )
    await browser.elementByCss(a(2)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit the home page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(3)).text()).toBe('another first page')
    await browser.elementByCss(a(3)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('first')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit another page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(4)).text()).toBe('another second page')
    await browser.elementByCss(a(4)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('second')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit another page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(5)).text()).toBe('image import page')
    await browser.elementByCss(a(5)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Image Import')
    expect(await browser.elementByCss(a(2)).text()).toBe('View the image')
    expect(await browser.elementByCss(a(2)).getAttribute('href')).toContain(
      '/test.3f1a293b.png'
    )
  } finally {
    await stopApp(app)
    nextConfig.restore()
    slugPage.restore()
  }
}

describe('app dir with next export', () => {
  it.each([{ trailingSlash: false }, { trailingSlash: true }])(
    "should work with trailingSlash '$trailingSlash'",
    async ({ trailingSlash }) => {
      await runTests({ trailingSlash })
    }
  )
  it.each([
    { dynamic: 'auto' },
    { dynamic: 'error' },
    { dynamic: 'force-static' },
  ])("should work with dynamic '$dynamic'", async ({ dynamic }) => {
    await runTests({ dynamic })
    const opts = { cwd: exportDir, nodir: true }
    const files = ((await glob('**/*', opts)) as string[])
      .filter((f) => !f.startsWith('_next/static/chunks/main-app-'))
      .sort()
    expect(files).toEqual([
      '404.html',
      '404/index.html',
      '_next/static/chunks/902-f97e36a07660afd2.js',
      '_next/static/chunks/app/another/[slug]/page-50aa8f87f076234b.js',
      '_next/static/chunks/app/another/page-67a4cd79c77b8516.js',
      '_next/static/chunks/app/image-import/page-46c0dca97a7a5cb8.js',
      '_next/static/chunks/app/layout-aea7b0f4dfb75fb2.js',
      '_next/static/chunks/app/page-73a72272c0754b1f.js',
      '_next/static/chunks/main-25b24f330fc66c8e.js',
      '_next/static/chunks/pages/_app-5b5607d0f696b287.js',
      '_next/static/chunks/pages/_error-e2f15669af03eac8.js',
      '_next/static/chunks/polyfills-c67a75d1b6f99dc8.js',
      '_next/static/chunks/webpack-8074fabf81ca3fbd.js',
      '_next/static/media/favicon.603d046c.ico',
      '_next/static/media/test.3f1a293b.png',
      '_next/static/test-build-id/_buildManifest.js',
      '_next/static/test-build-id/_ssgManifest.js',
      'another/first/index.html',
      'another/first/index.txt',
      'another/index.html',
      'another/index.txt',
      'another/second/index.html',
      'another/second/index.txt',
      'favicon.ico',
      'image-import/index.html',
      'image-import/index.txt',
      'index.html',
      'index.txt',
      'robots.txt',
    ])
  })
  it.each([{ dynamic: 'force-dynamic' }])(
    "should throw with dynamic '$dynamic'",
    async ({ dynamic }) => {
      expect('todo not implemented yet').toBe('todo not implemented yet')
    }
  )
})
