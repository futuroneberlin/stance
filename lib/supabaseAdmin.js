import { createClient } from '@supabase/supabase-js'

let supabaseAdmin = null

export function getSupabaseAdmin(){
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if(!url || !serviceKey){
    const err = new Error('SUPABASE_NOT_CONFIGURED')
    err.code = 'SUPABASE_NOT_CONFIGURED'
    throw err
  }

  if(!supabaseAdmin){
    supabaseAdmin = createClient(url, serviceKey)
  }

  return supabaseAdmin
}
