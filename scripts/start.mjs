import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const home = resolve(process.env.JUNHAO_HOME || fileURLToPath(new URL('../.junhao/home', import.meta.url)))
const overlay = fileURLToPath(new URL('../junhao.patch.yml', import.meta.url))
const cli = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))
await mkdir(home, { recursive: true })

const child = spawn(process.execPath, [
  cli, 'web', '--patch', overlay, ...process.argv.slice(2),
], {
  env: { ...process.env, DSH_HOME: home },
  stdio: 'inherit',
})

// Both processes receive terminal interrupts. Wait for DSH to shut down.
const onInterrupt = () => {}
process.on('SIGINT', onInterrupt)
child.once('error', error => {
  console.error('無法啟動 Junhao Harness。', error.message)
})
child.once('close', (code, signal) => {
  process.off('SIGINT', onInterrupt)
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1)
})
