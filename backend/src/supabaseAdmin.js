const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    '[supabaseAdmin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — copy backend/.env.example to backend/.env and fill both in from Supabase Dashboard > Settings > API. The server will start, but every Supabase call will fail until this is set.',
  )
}

// Fall back to a placeholder so createClient doesn't throw at boot when the
// .env hasn't been filled in yet — every real call will still fail clearly.
const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', serviceRoleKey || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false },
})

module.exports = { supabaseAdmin }
