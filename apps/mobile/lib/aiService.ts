import { supabase } from './supabase';

export type AIActionProposal = {
  id: string;
  action_type: string;
  module: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  requires_confirmation: boolean;
  payload: Record<string, unknown>;
  rationale: string | null;
};

export type AIDecision = {
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

export type AIResponse = {
  conversation_id: string;
  answer: string;
  intent: 'question' | 'analysis' | 'action';
  confidence: number | null;
  action_proposal: AIActionProposal | null;
  decision: AIDecision | null;
  rag_results: number;
};

export async function askAI(
  message: string,
  conversationId?: string | null,
): Promise<AIResponse> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    throw new Error('Message IA vide.');
  }

  const { data, error } = await supabase.functions.invoke(
    'enterprise-agent',
    {
      body: {
        message: cleanMessage,
        conversation_id: conversationId ?? null,
      },
    },
  );

  if (error) {
    const context = (error as any)?.context;

    console.log('=== ENTERPRISE AGENT ERROR ===');
    console.log('ERROR MESSAGE:', error.message);
    console.log('ERROR NAME:', error.name);

    if (context) {
      console.log('HTTP STATUS:', context.status);
      console.log('HTTP STATUS TEXT:', context.statusText);
    }

    if (context?.clone) {
      try {
        const response = context.clone();
        const rawBody = await response.text();

        console.log('=== EDGE FUNCTION RAW RESPONSE ===');
        console.log(rawBody);

        try {
          const body = JSON.parse(rawBody);

          if (body?.error) {
            throw new Error(String(body.error));
          }

          if (body?.message) {
            throw new Error(String(body.message));
          }
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message !== 'Unexpected end of JSON input'
          ) {
            throw parseError;
          }
        }
      } catch (readError) {
        console.log('EDGE RESPONSE READ ERROR:', readError);
      }
    }

    throw new Error(error.message || 'Erreur Edge Function.');
  }

  if (!data || data.error) {
    throw new Error(
      data?.error ?? 'Impossible de contacter l’Agent IA.',
    );
  }

  return data as AIResponse;
}


export async function confirmAIAction(
  proposalId: string,
): Promise<{
  proposal: AIActionProposal | null;
  decision: AIDecision | null;
}> {
  if (!proposalId) {
    throw new Error('Identifiant de proposition manquant.');
  }

  const { data, error } = await supabase.functions.invoke(
    'enterprise-confirm-action',
    {
      body: {
        proposal_id: proposalId,
      },
    },
  );

  if (error) {
    console.log('=== ENTERPRISE AGENT ERROR ===');
    console.log('message:', error.message);
    console.log('name:', error.name);
    console.log('context:', (error as any)?.context);

    const context = (error as any)?.context;

    if (context?.clone) {
      try {
        const response = context.clone();
        const text = await response.text();

        console.log('EDGE RESPONSE:', text);

        try {
          const body = JSON.parse(text);

          if (body?.error) {
            throw new Error(String(body.error));
          }

          if (body?.message) {
            throw new Error(String(body.message));
          }
        } catch (jsonError) {
          if (
            jsonError instanceof Error &&
            jsonError.message !== 'Unexpected end of JSON input'
          ) {
            throw jsonError;
          }
        }
      } catch (contextError) {
        if (
          contextError instanceof Error &&
          contextError.message !== error.message
        ) {
          throw contextError;
        }
      }
    }

    throw new Error(error.message || 'Erreur interne de l’Agent IA.');
  }

  if (!data || data.error) {
    throw new Error(
      data?.error ?? 'Impossible de confirmer l’action.',
    );
  }

  return {
    proposal: data.proposal ?? null,
    decision: data.decision ?? null,
  };
}

export async function executeAIAction(
  proposalId: string,
): Promise<{
  message?: string;
  result?: Record<string, unknown>;
  proposal?: AIActionProposal | null;
}> {
  if (!proposalId) {
    throw new Error('Identifiant de proposition manquant.');
  }

  const { data, error } = await supabase.functions.invoke(
    'enterprise-execute-action',
    {
      body: {
        proposal_id: proposalId,
      },
    },
  );

  if (error) {
    console.log('=== ENTERPRISE AGENT ERROR ===');
    console.log('message:', error.message);
    console.log('name:', error.name);
    console.log('context:', (error as any)?.context);

    const context = (error as any)?.context;

    if (context?.clone) {
      try {
        const response = context.clone();
        const text = await response.text();

        console.log('EDGE RESPONSE:', text);

        try {
          const body = JSON.parse(text);

          if (body?.error) {
            throw new Error(String(body.error));
          }

          if (body?.message) {
            throw new Error(String(body.message));
          }
        } catch (jsonError) {
          if (
            jsonError instanceof Error &&
            jsonError.message !== 'Unexpected end of JSON input'
          ) {
            throw jsonError;
          }
        }
      } catch (contextError) {
        if (
          contextError instanceof Error &&
          contextError.message !== error.message
        ) {
          throw contextError;
        }
      }
    }

    throw new Error(error.message || 'Erreur interne de l’Agent IA.');
  }

  if (!data || data.error) {
    throw new Error(
      data?.error ?? 'Impossible d’exécuter l’action.',
    );
  }

  return {
    message: data.message,
    result: data.result ?? data,
    proposal: data.proposal ?? null,
  };
}
