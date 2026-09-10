import { supabase } from './supabase';

export type CompanyDocumentSettings = {
  organization_id: string;
  legal_name: string | null;
  trade_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  registration_id: string | null;
  default_currency: string;
  payment_terms: string | null;
  legal_mentions: string | null;
  default_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DocumentType = 'quote' | 'invoice';

export type DocumentTemplate = {
  id: string;
  organization_id: string;
  document_type: DocumentType;
  name: string;
  rag_document_id: string | null;
  storage_path: string | null;
  content: string | null;
  variables: string[];
  formatting_rules: Record<string, unknown>;
  is_default: boolean;
  status: 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyDocumentSettingsInput = {
  organizationId: string;
  legalName?: string | null;
  tradeName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxId?: string | null;
  registrationId?: string | null;
  defaultCurrency?: string;
  paymentTerms?: string | null;
  legalMentions?: string | null;
  defaultNotes?: string | null;
  metadata?: Record<string, unknown>;
};

export type DocumentTemplateInput = {
  organizationId: string;
  documentType: DocumentType;
  name: string;
  content: string;
  variables?: string[];
  formattingRules?: Record<string, unknown>;
  isDefault?: boolean;
  storagePath?: string | null;
};

const TABLE = 'document_templates';
const SETTINGS_TABLE = 'company_document_settings';
const BUCKET = 'enterprise-documents';

export async function getCompanyDocumentSettings(
  organizationId: string,
): Promise<CompanyDocumentSettings | null> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw error;

  return data as CompanyDocumentSettings | null;
}

export async function saveCompanyDocumentSettings(
  input: CompanyDocumentSettingsInput,
): Promise<CompanyDocumentSettings> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from(SETTINGS_TABLE)
    .upsert({
      organization_id: input.organizationId,
      legal_name: input.legalName ?? null,
      trade_name: input.tradeName ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      tax_id: input.taxId ?? null,
      registration_id: input.registrationId ?? null,
      default_currency: input.defaultCurrency ?? 'XAF',
      payment_terms: input.paymentTerms ?? null,
      legal_mentions: input.legalMentions ?? null,
      default_notes: input.defaultNotes ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  return data as CompanyDocumentSettings;
}

export async function listDocumentTemplates(
  organizationId: string,
  documentType?: DocumentType,
): Promise<DocumentTemplate[]> {
  let query = supabase
    .schema('enterprise')
    .from(TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('document_type')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as DocumentTemplate[];
}

export async function getDefaultDocumentTemplate(
  organizationId: string,
  documentType: DocumentType,
): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .schema('enterprise')
    .rpc('get_default_document_template', {
      p_organization_id: organizationId,
      p_document_type: documentType,
    });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  return row ? (row as DocumentTemplate) : null;
}

export async function createDocumentTemplate(
  input: DocumentTemplateInput,
): Promise<DocumentTemplate> {
  if (!input.content.trim()) {
    throw new Error('Le contenu du modèle est obligatoire.');
  }

  const rag = await supabase.functions.invoke('enterprise-rag', {
    body: {
      action: 'ingest',
      organization_id: input.organizationId,
      title: input.name,
      content: input.content,
      category: 'document_template',
      document_type: input.documentType,
      source_type: 'template',
      storage_path: input.storagePath ?? null,
      metadata: {
        template_name: input.name,
        document_type: input.documentType,
      },
    },
  });

  if (rag.error) throw rag.error;

  const ragDocumentId = rag.data?.document_id as string | undefined;

  if (!ragDocumentId) {
    throw new Error('Le modèle RAG n’a pas pu être créé.');
  }

  const { data, error } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .insert({
      organization_id: input.organizationId,
      document_type: input.documentType,
      name: input.name.trim(),
      rag_document_id: ragDocumentId,
      storage_path: input.storagePath ?? null,
      content: input.content.trim(),
      variables: input.variables ?? [],
      formatting_rules: input.formattingRules ?? {},
      is_default: false,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) {
    await supabase
      .schema('enterprise')
      .from('rag_documents')
      .update({ status: 'archived' })
      .eq('id', ragDocumentId);

    throw error;
  }

  const template = data as DocumentTemplate;

  if (input.isDefault) {
    return setDefaultDocumentTemplate(
      input.organizationId,
      template.id,
      input.documentType,
    );
  }

  return template;
}

export async function updateDocumentTemplate(
  templateId: string,
  input: Partial<Omit<DocumentTemplateInput, 'organizationId'>>,
  organizationId: string,
): Promise<DocumentTemplate> {
  const { data: current, error: currentError } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .select('*')
    .eq('id', templateId)
    .eq('organization_id', organizationId)
    .single();

  if (currentError) throw currentError;

  const currentTemplate = current as DocumentTemplate;

  let ragDocumentId = currentTemplate.rag_document_id;

  if (input.content && input.content.trim()) {
    const rag = await supabase.functions.invoke('enterprise-rag', {
      body: {
        action: 'ingest',
        organization_id: organizationId,
        title: input.name?.trim() || currentTemplate.name,
        content: input.content,
        category: 'document_template',
        document_type: input.documentType ?? currentTemplate.document_type,
        source_type: 'template',
        storage_path:
          input.storagePath !== undefined
            ? input.storagePath
            : currentTemplate.storage_path,
        metadata: {
          template_name: input.name?.trim() || currentTemplate.name,
          document_type:
            input.documentType ?? currentTemplate.document_type,
        },
      },
    });

    if (rag.error) throw rag.error;

    const newRagDocumentId = rag.data?.document_id as string | undefined;

    if (!newRagDocumentId) {
      throw new Error('La mise à jour RAG a échoué.');
    }

    ragDocumentId = newRagDocumentId;
  }

  const { data, error } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .update({
      document_type: input.documentType ?? currentTemplate.document_type,
      name: input.name?.trim() || currentTemplate.name,
      rag_document_id: ragDocumentId,
      storage_path:
        input.storagePath !== undefined
          ? input.storagePath
          : currentTemplate.storage_path,
      content:
        input.content !== undefined
          ? input.content.trim()
          : currentTemplate.content,
      variables: input.variables ?? currentTemplate.variables,
      formatting_rules:
        input.formattingRules ?? currentTemplate.formatting_rules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', organizationId)
    .select('*')
    .single();

  if (error) throw error;

  if (
    currentTemplate.rag_document_id &&
    ragDocumentId &&
    currentTemplate.rag_document_id !== ragDocumentId
  ) {
    await supabase
      .schema('enterprise')
      .from('rag_documents')
      .update({ status: 'archived' })
      .eq('id', currentTemplate.rag_document_id);
  }

  const template = data as DocumentTemplate;

  if (input.isDefault) {
    return setDefaultDocumentTemplate(
      organizationId,
      template.id,
      template.document_type,
    );
  }

  return template;
}

export async function setDefaultDocumentTemplate(
  organizationId: string,
  templateId: string,
  documentType: DocumentType,
): Promise<DocumentTemplate> {
  const { error: clearError } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .update({ is_default: false })
    .eq('organization_id', organizationId)
    .eq('document_type', documentType)
    .eq('status', 'active')
    .neq('id', templateId);

  if (clearError) throw clearError;

  const { data, error } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .update({
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', organizationId)
    .eq('document_type', documentType)
    .select('*')
    .single();

  if (error) throw error;

  return data as DocumentTemplate;
}

export async function archiveDocumentTemplate(
  organizationId: string,
  templateId: string,
): Promise<void> {
  const { data: template, error: templateError } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .select('rag_document_id')
    .eq('id', templateId)
    .eq('organization_id', organizationId)
    .single();

  if (templateError) throw templateError;

  const { error } = await supabase
    .schema('enterprise')
    .from(TABLE)
    .update({
      status: 'archived',
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', organizationId);

  if (error) throw error;

  if (template?.rag_document_id) {
    await supabase
      .schema('enterprise')
      .from('rag_documents')
      .update({ status: 'archived' })
      .eq('id', template.rag_document_id);
  }
}

export async function uploadDocumentTemplateFile(
  organizationId: string,
  filePath: string,
  file: Blob | ArrayBuffer,
  contentType?: string,
): Promise<string> {
  const safePath = `${organizationId}/templates/${filePath.replace(/^\/+/, '')}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(safePath, file, {
      contentType: contentType ?? 'application/octet-stream',
      upsert: false,
    });

  if (error) throw error;

  return data.path;
}

export async function createDocumentTemplateSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;

  return data.signedUrl;
}
