const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')
const crypto = require('crypto')
const { PORT = 3000, WEB_HOST = '0.0.0.0', OWNER_NAME = 'VØRAXIS MD' } = process.env

const ROOT = path.join(__dirname)
const PUBLIC = path.join(ROOT, 'public')
const SESSIONS = path.join(ROOT, 'sessions')
const PLUGINS_DIR = path.join(ROOT, '..', 'plugins')
fs.mkdirSync(SESSIONS, { recursive: true })

const sessions = new Map()
let baileys = null
let pluginsCount = 0
try {
  pluginsCount = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js')).length
} catch (e) {
  pluginsCount = 0
}

async function loadBaileys() {
  if (!baileys) baileys = await import('baileys')
  return baileys
}

function json(res, code, data) {
  const body = JSON.stringify(data)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy() })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function cleanNumber(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '')
}

function publicSession(s) {
  return {
    sessionId: s.id,
    method: s.method,
    number: s.number,
    status: s.status,
    pairingCode: s.pairingCode,
    qr: s.qr,
    error: s.error,
    createdAt: s.createdAt,
    connectedAt: s.connectedAt,
    phoneNumber: s.phoneNumber,
    pluginsCount,
  }
}

function attach(session, lib) {
  const { sock } = session
  sock.ev.on('creds.update', session.saveCreds)
  sock.ev.on('connection.update', (update) => {
    const s = sessions.get(session.id)
    if (!s) return
    if (update.qr) {
      s.qr = update.qr
      if (s.status !== 'connected') s.status = 'qr_ready'
    }
    if (update.connection === 'connecting' && s.status !== 'connected') {
      s.status = 'connecting'
    }
    if (update.connection === 'open') {
      s.status = 'connected'
      s.connectedAt = Date.now()
      s.error = null
      try { s.phoneNumber = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : s.number } catch (e) { s.phoneNumber = s.number }
    }
    if (update.connection === 'close') {
      const wasConnected = s.status === 'connected'
      s.status = 'disconnected'
      if (update.lastDisconnect?.error) s.error = String(update.lastDisconnect.error.message || update.lastDisconnect.error)
      if (!wasConnected && !s.error) s.error = 'La session a été fermée avant la fin de la liaison.'
    }
  })
}

async function createSession(method, number) {
  const lib = await loadBaileys()
  const sessionId = crypto.randomUUID()
  const authDir = path.join(SESSIONS, sessionId)
  fs.mkdirSync(authDir, { recursive: true })
  const { state, saveCreds } = await lib.useMultiFileAuthState(authDir)
  const { version } = await lib.fetchLatestBaileysVersion()
  const sock = lib.default({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: lib.Browsers?.macOS?.('VØRAXIS MD') || ['VØRAXIS MD', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  const session = {
    id: sessionId,
    method,
    number: number || null,
    status: 'waiting',
    pairingCode: null,
    qr: null,
    error: null,
    sock,
    saveCreds,
    authDir,
    createdAt: Date.now(),
    connectedAt: null,
    phoneNumber: null,
  }
  sessions.set(sessionId, session)
  attach(session, lib)

  if (!state.creds.registered) {
    if (method === 'code') {
      await new Promise(resolve => setTimeout(resolve, 1500))
      session.pairingCode = await sock.requestPairingCode(number)
      session.status = 'code_ready'
    }
    // for method 'qr' we simply wait for the 'qr' field on connection.update
  } else {
    session.status = 'connected'
    session.connectedAt = Date.now()
  }
  return session
}

async function destroySession(session, { wipe } = { wipe: true }) {
  try { await session.sock.logout() } catch (e) { /* already closed */ }
  try { session.sock.ev.removeAllListeners() } catch (e) {}
  sessions.delete(session.id)
  if (wipe) {
    try { fs.rmSync(session.authDir, { recursive: true, force: true }) } catch (e) {}
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url, true)

    if (parsed.pathname === '/api/health') {
      return json(res, 200, { ok: true, name: OWNER_NAME, service: 'web-pairing', pluginsCount, activeSessions: sessions.size })
    }

    if (parsed.pathname === '/api/session' && req.method === 'POST') {
      const body = await readBody(req)
      const method = body.method === 'qr' ? 'qr' : 'code'
      let number = null
      if (method === 'code') {
        number = cleanNumber(body.number)
        if (!number || number.length < 8) return json(res, 400, { ok: false, error: 'Numéro WhatsApp invalide.' })
      }
      try {
        const session = await createSession(method, number)
        return json(res, 200, { ok: true, ...publicSession(session) })
      } catch (e) {
        return json(res, 500, { ok: false, error: e.message || 'Impossible de démarrer la session.' })
      }
    }

    const logoutMatch = parsed.pathname.match(/^\/api\/session\/([^/]+)\/logout$/)
    if (logoutMatch && req.method === 'POST') {
      const s = sessions.get(logoutMatch[1])
      if (!s) return json(res, 404, { ok: false, error: 'Session introuvable.' })
      await destroySession(s, { wipe: true })
      return json(res, 200, { ok: true })
    }

    const statusMatch = parsed.pathname.match(/^\/api\/session\/([^/]+)$/)
    if (statusMatch && req.method === 'GET') {
      const s = sessions.get(statusMatch[1])
      if (!s) return json(res, 404, { ok: false, error: 'Session introuvable.' })
      return json(res, 200, { ok: true, ...publicSession(s) })
    }

    if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(PUBLIC, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html)
    }

    return json(res, 404, { ok: false, error: 'Not found' })
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'Server error' })
  }
})

server.listen(Number(PORT), WEB_HOST, () => console.log(`[${OWNER_NAME}] Web panel: http://${WEB_HOST}:${PORT}`))
