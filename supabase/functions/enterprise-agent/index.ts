import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!

const publishableKeys = JSON.parse(
  Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}',
)

const publishableKey =
  publishableKeys.default ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

const ragModel = new Supabase.ai.Session('gte-small')

const ALLOWED_MODULES = new Set([
  'direction',
  'finance',
  'hr',
  'communication',
  'commercial',
  'tasks',
  'ai',
  'profile',
])

const ALLOWED_RISKS = new Set([
  'low',
  'medium',
  'high',
  'critical',
])

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization')

  if (!auth) {
    throw new Response(
      JSON.stringify({ error: 'Authorization requise' }),
      { status: 401 },
    )
  }

  const supabase = createClient(
    supabaseUrl,
    publishableKey,
    {
      global: {
        headers: {
          Authorization: auth,
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response(
      JSON.stringify({ error: 'Session invalide' }),
      { status: 401 },
    )
  }

  return { supabase, user }
}

async function getOrganization(
  supabase: any,
  userId: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data?.organization_id) {
    throw new Error(
      'Aucune organisation associée à cet utilisateur.',
    )
  }

  return data
}

async function hasPermission(
  supabase: any,
  organizationId: string,
  module: string,
  action: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .rpc('has_permission', {
      p_organization_id: organizationId,
      p_module: module,
      p_action: action,
    })

  if (error) throw error

  return data === true
}

async function getConversation(
  supabase: any,
  organizationId: string,
  userId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('ai_conversations')
    .select('id, organization_id, user_id, title, status, context')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    throw new Error(
      'Conversation IA introuvable ou non autorisée.',
    )
  }

  return data
}

async function getConversationMessages(
  supabase: any,
  organizationId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('ai_messages')
    .select('role, content, metadata, created_at')
    .eq('organization_id', organizationId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw error
  return (data ?? []).reverse()
}

async function updateConversationContext(
  supabase: any,
  organizationId: string,
  conversationId: string,
  context: Record<string, unknown>,
) {
  const { error } = await supabase
    .schema('enterprise')
    .from('ai_conversations')
    .update({
      context,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)

  if (error) throw error
}

async function getBusinessContext(
  supabase: any,
  organizationId: string,
) {
  const [
    canDirection,
    canFinance,
    canHR,
    canCommercial,
    canTasks,
    canCommunication,
  ] = await Promise.all([
    hasPermission(supabase, organizationId, 'direction', 'view'),
    hasPermission(supabase, organizationId, 'finance', 'view'),
    hasPermission(supabase, organizationId, 'hr', 'view'),
    hasPermission(supabase, organizationId, 'commercial', 'view'),
    hasPermission(supabase, organizationId, 'tasks', 'view'),
    hasPermission(
      supabase,
      organizationId,
      'communication',
      'view',
    ),
  ])

  const result: Record<string, unknown> = {
    accessible_modules: [],
  }

  const accessibleModules = result.accessible_modules as string[]

  if (canDirection) {
    accessibleModules.push('direction')
  }

  if (canFinance) {
    accessibleModules.push('finance')
  }

  if (canHR) {
    accessibleModules.push('hr')
  }

  if (canCommercial) {
    accessibleModules.push('commercial')
  }

  if (canTasks) {
    accessibleModules.push('tasks')
  }

  if (canCommunication) {
    accessibleModules.push('communication')
  }

  const requests: Promise<void>[] = []

  if (canCommercial) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('customers')
          .select('id,name,status')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        result.customers = data ?? []
      })(),
    )
  }

  if (canFinance) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('suppliers')
          .select('id,name,status')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        result.suppliers = data ?? []
      })(),
    )

    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('invoices')
          .select(
            'id,customer_id,number,status,currency,subtotal,tax,total,issue_date,due_date',
          )
          .eq('organization_id', organizationId)
          .order('issue_date', { ascending: false })
          .limit(50)

        if (error) throw error
        result.invoices = data ?? []
      })(),
    )

    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('expenses')
          .select(
            'id,supplier_id,description,amount,currency,status,expense_date',
          )
          .eq('organization_id', organizationId)
          .order('expense_date', { ascending: false })
          .limit(50)

        if (error) throw error
        result.expenses = data ?? []
      })(),
    )

    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('payments')
          .select(
            'id,invoice_id,amount,currency,payment_method,paid_at',
          )
          .eq('organization_id', organizationId)
          .order('paid_at', { ascending: false })
          .limit(50)

        if (error) throw error
        result.payments = data ?? []
      })(),
    )
  }

  if (canHR) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('employees')
          .select(
            'id,first_name,last_name,role,department,status',
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        result.employees = data ?? []
      })(),
    )
  }

  if (canTasks) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('tasks')
          .select(
            'id,title,status,priority,due_at,assigned_to',
          )
          .eq('organization_id', organizationId)
          .order('due_at', {
            ascending: true,
            nullsFirst: false,
          })
          .limit(100)

        if (error) throw error
        result.tasks = data ?? []
      })(),
    )
  }

  if (canCommunication) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('notifications')
          .select(
            'id,type,title,message,read_at,created_at',
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        result.notifications = data ?? []
      })(),
    )
  }

  if (canDirection || canFinance) {
    requests.push(
      (async () => {
        const { data, error } = await supabase
          .schema('enterprise')
          .from('organizations')
          .select('id,name,status')
          .eq('id', organizationId)
          .maybeSingle()

        if (error) throw error
        result.organization = data ?? null
      })(),
    )
  }

  await Promise.all(requests)

  return result
}

async function searchRag(
  supabase: any,
  organizationId: string,
  query: string,
) {
  try {
    const embedding = await ragModel.run(query, {
      mean_pool: true,
      normalize: true,
    })

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('search_rag_chunks', {
        p_organization_id: organizationId,
        p_query_embedding: embedding,
        p_match_threshold: 0.65,
        p_match_count: 8,
        p_category: null,
      })

    if (error) {
      console.error('RAG search error:', error)
      return []
    }

    return data ?? []
  } catch (error) {
    console.error('RAG embedding error:', error)
    return []
  }
}


type DecisionEngineDecision = {
  difficulty: number;
  risk: number;
  level: string;
  agents: string[];
  debate: boolean;
  arbitration: boolean;
  human: boolean;
  uncertainty: boolean;
  reason: string;
  engine_version: string;
  classifier_version: string;
};

function mapDecisionRisk(decision: DecisionEngineDecision): string {
  if (
    decision.human ||
    decision.arbitration ||
    decision.risk >= 8
  ) {
    return 'critical';
  }

  if (decision.risk >= 5 || decision.debate) {
    return 'high';
  }

  if (decision.risk >= 3 || decision.uncertainty) {
    return 'medium';
  }

  return 'low';
}

async function callDecisionEngine(input: {
  tenantId: string;
  description: string;
  requester: string;
  requestId: string;
}): Promise<DecisionEngineDecision> {
  const baseUrl = Deno.env.get('DECISION_ENGINE_URL')?.trim();
  const apiKey = Deno.env.get('DECISION_ENGINE_API_KEY')?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Decision Engine non configuré. DECISION_ENGINE_URL et DECISION_ENGINE_API_KEY sont requis.',
    );
  }

  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/v1/decide/contextual`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        tenant_id: input.tenantId,
        description: input.description,
        requester: input.requester,
        request_id: input.requestId,
      }),
    },
  );

  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Réponse Decision Engine invalide (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ??
        `Erreur Decision Engine (${response.status}).`,
    );
  }

  if (
    !data?.decision ||
    typeof data.decision.risk !== 'number' ||
    typeof data.decision.difficulty !== 'number'
  ) {
    throw new Error('Décision Decision Engine invalide.');
  }

  return data.decision as DecisionEngineDecision;
}

function buildPrompt(
  message: string,
  role: string,
  business: Record<string, unknown>,
  rag: unknown[],
  conversationContext: Record<string, unknown>,
  history: unknown[],
) {
  return `
Tu es l'Agent IA opérationnel d'un logiciel de gestion d'entreprise.

OBJECTIF :
Comprendre l'intention de l'utilisateur, maintenir le contexte conversationnel et préparer des actions professionnelles utiles.

RÈGLES ABSOLUES :
- Réponds en français.
- Sois concret, court et professionnel.
- N'invente jamais une donnée.
- Utilise uniquement les données accessibles.
- Ne prétends jamais avoir exécuté une action.
- Toute action est une PROPOSITION jusqu'à confirmation/exécution.
- Ne recherche jamais une donnée métier uniquement parce qu'un mot apparaît dans le texte d'un paramètre.
- Un texte fourni comme titre, description ou contenu d'action doit rester ce texte.
- Pour une tâche, "Appeler le client Gabon Télécom" est un TITRE DE TÂCHE. Cela ne signifie pas qu'il faut rechercher un client nommé Gabon Télécom.
- Ne renseigne jamais client_id, customer_id ou autre identifiant métier sans demande explicite ou correspondance non ambiguë.
- Si une information obligatoire manque, demande uniquement cette information.
- due_at et priority sont facultatifs pour tasks.create_task sauf si les règles métier indiquent autrement.
- Si le message actuel complète une action commencée au tour précédent, utilise prioritairement le contexte conversationnel.
- "annule", "stop", "annuler", "laisse tomber" annule l'action en cours.

RÔLE :
${role}

MODULES ACCESSIBLES :
${JSON.stringify(business.accessible_modules ?? [])}

ÉTAT DE CONVERSATION :
${JSON.stringify(conversationContext)}

HISTORIQUE RÉCENT :
${JSON.stringify(history)}

DEMANDE ACTUELLE :
${message}

DONNÉES MÉTIER AUTORISÉES :
${JSON.stringify(business)}

DOCUMENTS RAG PERTINENTS :
${JSON.stringify(rag)}

IMPORTANT :
- Ne crée jamais un nouveau type d'action.
- Respecte strictement le catalogue d'actions.
- Le RAG sert à rechercher de l'information, pas à inventer les paramètres transactionnels.
- Si une action est en cours et qu'un paramètre manque, conserve les paramètres déjà connus.
- Pour tasks.create_task, le champ title est obligatoire.
- Si title manque, retourne une réponse demandant le titre et aucune action exécutable.
- Si title est disponible, prépare l'action.
- Le champ payload doit contenir uniquement les paramètres réellement connus.

Retourne UNIQUEMENT un JSON valide :

{
  "answer": "réponse concise",
  "intent": "question|analysis|action",
  "confidence": 0,
  "conversation_state": {
    "intent": "tasks.create_task|null",
    "status": "idle|collecting|ready|cancelled",
    "fields": {}
  },
  "action": null
}

Pour une action prête :

{
  "answer": "description de ce qui sera préparé",
  "intent": "action",
  "confidence": 0,
  "conversation_state": {
    "intent": "tasks.create_task",
    "status": "ready",
    "fields": {
      "title": "..."
    }
  },
  "action": {
    "type": "tasks.create_task",
    "module": "tasks",
    "risk_level": "low",
    "requires_confirmation": true,
    "payload": {},
    "rationale": "raison"
  }
}
`
}
async function callModel(prompt: string) {
  const apiUrl = Deno.env.get('AI_API_URL')
  const apiKey = Deno.env.get('AI_API_KEY')
  const model = Deno.env.get('AI_MODEL')

  if (!apiUrl || !apiKey || !model) {
    throw new Error(
      'Fournisseur IA non configuré. AI_API_URL, AI_API_KEY et AI_MODEL sont requis.',
    )
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un agent IA professionnel. Retourne uniquement du JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const text = await response.text()

    if (response.status === 429 || response.status === 503) {
      throw new Response(
        JSON.stringify({
          error: 'Le service IA est temporairement indisponible. Réessayez dans quelques instants.',
          code: 'AI_PROVIDER_UNAVAILABLE',
          retryable: true,
          provider_status: response.status,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    throw new Error(
      `Erreur fournisseur IA (${response.status}): ${text}`,
    )
  }

  const data = await response.json()

  const content =
    data?.choices?.[0]?.message?.content ??
    data?.output_text ??
    data?.content

  if (!content) {
    throw new Error('Réponse IA vide.')
  }

  const cleaned = String(content)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.answer !== 'string'
    ) {
      throw new Error('Format IA invalide.')
    }

    return parsed
  } catch {
    return {
      answer: cleaned,
      intent: 'question',
      confidence: 0.5,
      action: null,
    }
  }
}

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

function normalizeAction(action: any) {
  if (!action || typeof action !== 'object') {
    return null
  }

  const type =
    typeof action.type === 'string'
      ? action.type.trim()
      : ''

  if (!type) {
    return null
  }

  const policy = AI_ACTION_POLICIES[type]

  if (!policy) {
    return null
  }

  const module =
    typeof action.module === 'string'
      ? action.module.trim()
      : ''

  if (module !== policy.module) {
    return null
  }

  return {
    type,
    module: policy.module,
    permission: policy.permission,
    requires_confirmation: true,
    payload:
      action.payload &&
      typeof action.payload === 'object'
        ? action.payload
        : {},
    rationale:
      typeof action.rationale === 'string'
        ? action.rationale.slice(0, 1000)
        : null,
  }
}

async function createProposal(
  supabase: any,
  organizationId: string,
  userId: string,
  conversationId: string,
  action: any,
  decision: DecisionEngineDecision,
) {
  const riskLevel = mapDecisionRisk(decision);

  const requiresConfirmation =
    decision.risk >= 3 ||
    decision.debate ||
    decision.arbitration ||
    decision.human;

  const { data, error } = await supabase
    .schema('enterprise')
    .from('ai_action_proposals')
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      requested_by: userId,
      action_type: action.type,
      module: action.module,
      risk_level: riskLevel,
      status: 'proposed',
      requires_confirmation: requiresConfirmation,
      payload: action.payload,
      rationale: action.rationale,
      decision,
    })
    .select(
      'id,action_type,module,risk_level,status,requires_confirmation,payload,rationale,decision',
    )
    .single()

  if (error) throw error

  return data
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST requis' }, 405)
  }

  try {
    const { supabase, user } = await requireUser(req)
    const body = await req.json()

    const message = String(
      body.message ?? '',
    ).trim()

    if (!message) {
      return json(
        { error: 'message requis' },
        400,
      )
    }

    if (message.length > 4000) {
      return json(
        {
          error:
            'Message trop long. Limite : 4000 caractères.',
        },
        400,
      )
    }

    const organization = await getOrganization(
      supabase,
      user.id,
    )

    const organizationId =
      organization.organization_id

    const role = organization.role

    const canUseAI = await hasPermission(
      supabase,
      organizationId,
      'ai',
      'create',
    )

    if (!canUseAI) {
      return json(
        { error: 'Permission IA refusée' },
        403,
      )
    }

    let conversationId =
      typeof body.conversation_id === 'string' &&
      body.conversation_id.trim()
        ? body.conversation_id.trim()
        : null

    let conversation: any = null

    if (conversationId) {
      conversation = await getConversation(
        supabase,
        organizationId,
        user.id,
        conversationId,
      )
    } else {
      const { data, error } = await supabase
        .schema('enterprise')
        .from('ai_conversations')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          title: message.slice(0, 80),
        })
        .select('id')
        .single()

      if (error) throw error

      conversationId = data.id

      conversation = await getConversation(
        supabase,
        organizationId,
        user.id,
        conversationId,
      )
    }

    const conversationContext =
      conversation?.context &&
      typeof conversation.context === 'object'
        ? conversation.context
        : {}

    const history = await getConversationMessages(
      supabase,
      organizationId,
      conversationId,
    )

    await supabase
      .schema('enterprise')
      .from('ai_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: message,
      })

    const [business, rag] =
      await Promise.all([
        getBusinessContext(
          supabase,
          organizationId,
        ),
        searchRag(
          supabase,
          organizationId,
          message,
        ),
      ])

    const prompt = buildPrompt(
      message,
      role,
      business,
      rag,
      conversationContext,
      history,
    )

    const result = await callModel(prompt)

    let nextContext =
      result.conversation_state &&
      typeof result.conversation_state === 'object'
        ? result.conversation_state
        : conversationContext

    // Continuation déterministe d'une création de tâche :
    // si le tour précédent demandait le titre, le message actuel EST le titre.
    if (
      conversationContext?.intent === 'tasks.create_task' &&
      conversationContext?.status === 'collecting' &&
      conversationContext?.fields &&
      typeof conversationContext.fields === 'object' &&
      !((conversationContext.fields as Record<string, unknown>).title)
    ) {
      const lower = message.toLowerCase()

      if (['annule', 'annuler', 'stop', 'laisse tomber'].includes(lower)) {
        nextContext = {
          intent: null,
          status: 'cancelled',
          fields: {},
        }
        result.action = null
        result.intent = 'question'
        result.answer = 'Création de la tâche annulée.'
      } else {
        const previousFields =
          conversationContext.fields as Record<string, unknown>

        nextContext = {
          intent: 'tasks.create_task',
          status: 'ready',
          fields: {
            ...previousFields,
            title: message,
          },
        }

        result.intent = 'action'
        result.answer = `Je prépare la tâche « ${message} ».`
        result.action = {
          type: 'tasks.create_task',
          module: 'tasks',
          risk_level: 'low',
          requires_confirmation: true,
          payload: {
            ...previousFields,
            title: message,
          },
          rationale: 'Création d’une tâche demandée par l’utilisateur.',
        }
      }
    }

    await updateConversationContext(
      supabase,
      organizationId,
      conversationId,
      nextContext,
    )

    let proposal = null
    let decision: DecisionEngineDecision | null = null

    const action = normalizeAction(
      result.action,
    )

    if (action) {
      decision = await callDecisionEngine({
        tenantId: organizationId,
        description: JSON.stringify({
          user_message: message,
          action_type: action.type,
          module: action.module,
          payload: action.payload,
          rationale: action.rationale,
          conversation_context: nextContext,
        }),
        requester: user.id,
        requestId: conversationId,
      })

      const decisionRisk = mapDecisionRisk(decision);

      proposal = await createProposal(
        supabase,
        organizationId,
        user.id,
        conversationId,
        {
          ...action,
          risk_level: decisionRisk,
        },
        decision,
      )

      result.action = {
        type: action.type,
        module: action.module,
        risk_level: decisionRisk,
        requires_confirmation: true,
        payload: action.payload,
        rationale: action.rationale,
      }
    } else {
      result.action = null
    }

    const answer =
      typeof result.answer === 'string'
        ? result.answer
        : 'Je n’ai pas pu produire une réponse exploitable.'

    await supabase
      .schema('enterprise')
      .from('ai_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: answer,
        metadata: {
          intent:
            result.intent ?? 'question',
          confidence:
            result.confidence ?? null,
          proposal_id:
            proposal?.id ?? null,
          rag_results: rag.length,
          accessible_modules:
            business.accessible_modules,
          decision_engine:
            decision,
        },
      })

    return json({
      conversation_id: conversationId,
      answer,
      intent:
        result.intent ?? 'question',
      confidence:
        result.confidence ?? null,
      action_proposal: proposal,
      decision,
      rag_results: rag.length,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error('enterprise-agent error:', error)

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur interne',
      },
      500,
    )
  }
})
