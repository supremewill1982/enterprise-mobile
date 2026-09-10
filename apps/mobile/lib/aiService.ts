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
    throw error;
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
    throw error;
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
    throw error;
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
