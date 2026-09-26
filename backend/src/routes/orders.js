const express = require('express')
const { supabaseAdmin } = require('../supabaseAdmin')
const { assignDriverForOrder } = require('../assignment')
const { startTrip, stopTrip } = require('../tracking')

function createOrdersRouter(io) {
  const router = express.Router()

  // Called by the restaurant dashboard right after it marks an order READY
  // (that status change itself is still written by the restaurant's own
  // Supabase session, so the ownership trigger sees a real auth.uid()).
  // This just kicks off the driver-matching engine for that order.
  router.post('/:id/ready', async (req, res) => {
    await assignDriverForOrder(req.params.id, io)
    res.json({ ok: true })
  })

  router.post('/:id/pickup', async (req, res) => {
    const { driverId } = req.body
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'PICKED_UP', picked_up_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('driver_id', driverId)
      .eq('status', 'DRIVER_ASSIGNED')
      .select()
      .maybeSingle()

    if (error || !data) {
      return res.status(409).json({ ok: false, reason: 'Order is not awaiting pickup by this driver.' })
    }

    io.to(`order:${data.id}`).emit('order:update', data)
    startTrip(data.id, io)
    res.json({ ok: true, order: data })
  })

  router.post('/:id/deliver', async (req, res) => {
    const { driverId } = req.body
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('driver_id', driverId)
      .eq('status', 'PICKED_UP')
      .select()
      .maybeSingle()

    if (error || !data) {
      return res.status(409).json({ ok: false, reason: 'Order is not out for delivery with this driver.' })
    }

    stopTrip(data.id)
    io.to(`order:${data.id}`).emit('order:update', data)

    await supabaseAdmin.from('driver_payouts').insert({
      driver_id: driverId,
      order_id: data.id,
      amount: data.delivery_fee,
    })

    res.json({ ok: true, order: data })
  })

  return router
}

module.exports = { createOrdersRouter }
