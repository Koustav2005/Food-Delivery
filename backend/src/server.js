require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')

const { createOrdersRouter } = require('./routes/orders')
const { createOffersRouter } = require('./routes/offers')
const { recoverPendingAssignments } = require('./assignment')

const app = express()
const server = http.createServer(app)

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

const io = new Server(server, {
  cors: { origin: frontendOrigin },
})

app.use(cors({ origin: frontendOrigin }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/orders', createOrdersRouter(io))
app.use('/offers', createOffersRouter(io))

io.on('connection', (socket) => {
  socket.on('join:driver', (driverId) => socket.join(`driver:${driverId}`))
  socket.on('join:order', (orderId) => socket.join(`order:${orderId}`))
  socket.on('leave:order', (orderId) => socket.leave(`order:${orderId}`))
})

const port = process.env.PORT || 4000
server.listen(port, () => {
  console.log(`[server] listening on :${port}, accepting requests from ${frontendOrigin}`)
  // Give drivers' browsers a moment to reconnect and rejoin their
  // driver:<id> room after a restart before re-broadcasting any offers.
  setTimeout(() => recoverPendingAssignments(io), 5000)
})
