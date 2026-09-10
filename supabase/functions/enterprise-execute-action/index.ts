import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const publishableKeys = JSON.parse(
  Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}',
)
const publishableKey =
  publishableKeys.default ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Non authentifié.' }, 401)
  }

  const supabase = createClient(
    supabaseUrl,
    publishableKey,
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return json({ error: 'Non authentifié.' }, 401)
  }

  let body: { proposal_id?: string }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON invalide.' }, 400)
  }

  const proposalId =
    typeof body.proposal_id === 'string'
      ? body.proposal_id.trim()
      : ''

  if (!proposalId) {
    return json({ error: 'proposal_id requis.' }, 400)
  }

  const { data, error } = await supabase
    .schema('enterprise')
    .rpc('execute_ai_action', {
      p_proposal_id: proposalId,
    })

  if (error) {
    const statusByCode: Record<string, number> = {
      UNAUTHENTICATED: 401,
      PROPOSAL_NOT_FOUND: 404,
      PROPOSAL_NOT_CONFIRMED: 409,
      PROPOSAL_CONFIRMATION_INVALID: 409,
      ACTION_NOT_ALLOWED: 403,
      MODULE_MISMATCH: 403,
      BUSINESS_PERMISSION_DENIED: 403,
      DECISION_MISSING: 409,
    }

    const code = error.message?.trim() ?? ''

    return json(
      {
        error: code || 'Échec de l’exécution.',
      },
      statusByCode[code] ?? 400,
    )
  }

  return json({
    success: true,
    executed_by: user.id,
    result: data,
  })
})
