import { readFileSync } from 'node:fs'

const icon = readFileSync(new URL('./mark.svg', import.meta.url), 'utf8')
const dictionaries = JSON.parse(readFileSync(new URL('./zh-Hant.json', import.meta.url), 'utf8'))
const manifest = JSON.stringify({
  name: 'Junhao Harness',
  short_name: 'Junhao Harness',
  lang: 'zh-Hant',
  start_url: '../',
  scope: '../',
  display: 'standalone',
  icons: [{ src: 'mark.svg', sizes: 'any', type: 'image/svg+xml' }],
})

function asset(ctx, path, contentType, content) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/junhao/' + path,
    handler(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end()
        return
      }
      res.writeHead(200, { 'Content-Type': contentType }).end(content)
    },
  }))
}

export const inject = ['webServer']

export function apply(ctx) {
  asset(ctx, 'mark.svg', 'image/svg+xml', icon)
  asset(ctx, 'manifest.webmanifest', 'application/manifest+json', manifest)
  ctx.on('webserver/index-inject', table => {
    table.push({ kind: 'global', name: '__JUNHAO_DICTIONARIES__', value: dictionaries })
    table.push({
      kind: 'script',
      placement: 'head',
      text: 'globalThis.__DSH_LOCALE__ = { read: async () => ({ languages: ["zh-Hant", "zh"], preference: null }), onChange() {} };',
    })
  })
  ctx.effect(() => ctx.webServer.tapIndex(html => html
    .replace('<html lang="en">', '<html lang="zh-Hant">')
    .replace(/<title>[^<]*<\/title>/, '<title>Junhao Harness</title>')
    .replace(/(name="apple-mobile-web-app-title" content=")[^"]*"/, '$1Junhao Harness"')
    .replace(/(<link rel="manifest" href=")[^"]*"/, '$1./junhao/manifest.webmanifest"')
    .replace(/(<link rel="(?:apple-touch-icon|icon)"[^>]*? href=")[^"]*"/g, '$1./junhao/mark.svg"')))
}
