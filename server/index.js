import express from 'express'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { healthy } from './db.js'
import { attachUser } from './auth.js'
import authRoutes from './routes/auth.js'
import contentRoutes from './routes/content.js'
import userRoutes from './routes/users.js'

const app = express()
app.use(express.json({ limit: '12mb' })) // headroom for base64 images
app.use(cookieParser())
app.use(attachUser)

app.get('/api/health', (_req, res) => res.json({ ok: true, db: healthy() }))
app.use('/api/auth', authRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/users', userRoutes)

// Serve the built SPA (production / e2e). In dev, Vite serves + proxies /api here.
const DIST = join(import.meta.dirname, '..', 'dist')
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(DIST, 'index.html'))
  })
}

const PORT = Number(process.env.PORT || 8787)
app.listen(PORT, () => console.log(`[cfe] server on http://localhost:${PORT}`))
