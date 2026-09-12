import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const publishableKeys = JSON.parse(
  Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}',
)
const publishableKey =
  publishableKeys.default ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

const AI_ACTION_POLICIES: Record<string, {
  module: string;
  permission: 'create' | 'edit' | 'delete' | 'approve';
}> = {
  'tasks.create_task': { module: 'tasks', permission: 'create' },
  'tasks.update_task': { module: 'tasks', permission: 'edit' },
  'tasks.delete_task': { module: 'tasks', permission: 'delete' },
  'commercial.create_customer': { module: 'commercial', permission: 'create' },
  'commercial.update_customer': { module: 'commercial', permission: 'edit' },
  'commercial.create_quote': { module: 'commercial', permission: 'create' },
  'finance.create_invoice': { module: 'finance', permission: 'create' },
  'finance.update_invoice': { module: 'finance', permission: 'edit' },
  'finance.delete_invoice': { module: 'finance', permission: 'delete' },
  'finance.create_expense': { module: 'finance', permission: 'create' },
  'finance.approve_expense': { module: 'finance', permission: 'approve' },
  'hr.create_employee': { module: 'hr', permission: 'create' },
  'hr.update_employee': { module: 'hr', permission: 'edit' },
  'hr.delete_employee': { module: 'hr', permission: 'delete' },
  'communication.create_message': { module: 'communication', permission: 'create' },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

async function requireUser(req: Request) {
  const authorization = req.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Utilisateur non authentifié.')
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Utilisateur non authentifié.')
  }

  return { supabase, user }
}

async function getOrganizationId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data?.organization_id) {
    throw new Error('Aucune organisation associée à cet utilisateur.')
  }

  return data.organization_id
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405)
  }

  try {
    const { supabase, user } = await requireUser(req)
    const body = await req.json()

    const proposalId =
      typeof body?.proposal_id === 'string'
        ? body.proposal_id.trim()
        : ''

    if (!proposalId) {
      return json(
        {
          error: 'proposal_id est requis.',
        },
        400,
      )
    }

    const organizationId = await getOrganizationId(
      supabase,
      user.id,
    )

    const { data: canApprove, error: permissionError } =
      await supabase.schema('enterprise').rpc('has_permission', {
        p_organization_id: organizationId,
        p_module: 'ai',
        p_action: 'approve',
      })

    if (permissionError) throw permissionError

    if (!canApprove) {
      return json(
        {
          error: 'Permission refusée : ai.approve.',
        },
        403,
      )
    }

    const { data: proposal, error: proposalError } =
      await supabase
        .schema('enterprise')
        .from('ai_action_proposals')
        .select(
          'id,organization_id,requested_by,action_type,module,risk_level,status,requires_confirmation,payload,rationale,decision',
        )
        .eq('id', proposalId)
        .eq('organization_id', organizationId)
        .single()

    if (proposalError) {
      if (proposalError.code === 'PGRST116') {
        return json(
          {
            error: 'Proposition introuvable.',
          },
          404,
        )
      }

      throw proposalError
    }

    if (proposal.status !== 'proposed') {
      return json(
        {
          error: `La proposition ne peut plus être confirmée (statut: ${proposal.status}).`,
        },
        409,
      )
    }

    if (!proposal.requires_confirmation) {
      return json(
        {
          error: 'Cette proposition ne nécessite pas de confirmation.',
        },
        409,
      )
    }

    const policy = AI_ACTION_POLICIES[proposal.action_type]

    if (!policy) {
      return json(
        {
          error: 'Action IA non autorisée.',
        },
        403,
      )
    }

    if (proposal.module !== policy.module) {
      return json(
        {
          error: 'Module de l’action invalide.',
        },
        403,
      )
    }

    const { data: canPerformAction, error: actionPermissionError } =
      await supabase.schema('enterprise').rpc('has_permission', {
        p_organization_id: organizationId,
        p_module: policy.module,
        p_action: policy.permission,
      })

    if (actionPermissionError) throw actionPermissionError

    if (!canPerformAction) {
      return json(
        {
          error: `Permission refusée : ${policy.module}.${policy.permission}.`,
        },
        403,
      )
    }

    const decision = proposal.decision ?? {}

    const { data: updatedProposal, error: updateError } =
      await supabase
        .schema('enterprise')
        .from('ai_action_proposals')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.id)
        .eq('organization_id', organizationId)
        .eq('status', 'proposed')
        .select(
          'id,organization_id,action_type,module,risk_level,status,requires_confirmation,payload,rationale,decision,updated_at',
        )
        .single()

    if (updateError) throw updateError

    return json({
      success: true,
      message: 'Action confirmée. Aucune exécution n’a encore été effectuée.',
      proposal: updatedProposal,
      decision,
    })
  } catch (error) {
    console.error(error)

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la confirmation.',
      },
      500,
    )
  }
})
