const express = require('express')
const { respondToOffer } = require('../assignment')

function createOffersRouter(io) {
  const router = express.Router()

  router.post('/:id/respond', async (req, res) => {
    const { driverId, action } = req.body
    if (!driverId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ ok: false, reason: 'driverId and action ("accept"|"reject") are required.' })
    }

    const result = await respondToOffer(req.params.id, driverId, action, io)
    res.status(result.ok ? 200 : 409).json(result)
  })

  return router
}

module.exports = { createOffersRouter }
