import { supabase } from './supabase';

export type RagDocument = {
  id: string;
  organization_id: string;
  title: string;
  source_type: 'manual' | 'file' | 'template' | 'system';
  category: string;
  document_type: string | null;
  storage_path: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  status: 'active' | 'archived';
  processing_status:
    | 'pending_upload'
    | 'stored'
    | 'pending_extraction'
    | 'extracting'
    | 'pending_indexing'
    | 'indexing'
    | 'indexed'
    | 'error';
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RagResult = {
  id: string;
  document_id: string;
  title: string;
  category: string;
  document_type: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type RagIngestInput = {
  organizationId: string;
  title: string;
  content: string;
  category?: string;
  documentType?: string | null;
  metadata?: Record<string, unknown>;
  sourceType?: 'manual' | 'file' | 'template' | 'system';
  storagePath?: string | null;
};

export type RagSearchInput = {
  organizationId: string;
  query: string;
  category?: string | null;
  threshold?: number;
  limit?: number;
};

export function chunkText(
  text: string,
  size = 1200,
  overlap = 150,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));

    if (end === clean.length) break;

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export async function ingestRagDocument(input: RagIngestInput) {
  const { data, error } = await supabase.functions.invoke('enterprise-rag', {
    body: {
      action: 'ingest',
      organization_id: input.organizationId,
      title: input.title,
      content: input.content,
      category: input.category ?? 'general',
      document_type: input.documentType ?? null,
      source_type: input.sourceType ?? 'manual',
      storage_path: input.storagePath ?? null,
      metadata: input.metadata ?? {},
    },
  });

  if (error) throw error;

  return data as {
    document_id: string;
    chunks: number;
  };
}


export type RagDocumentCategory =
  | 'procedure'
  | 'template'
  | 'policy'
  | 'commercial'
  | 'hr'
  | 'finance'
  | 'other';

export type RagFileInput = {
  organizationId: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
  file: ArrayBuffer;
  category: RagDocumentCategory;
  documentType?: string | null;
  metadata?: Record<string, unknown>;
};

const RAG_BUCKET = 'enterprise-documents';

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'document';
}

export async function uploadRagDocumentFile(
  input: RagFileInput,
): Promise<RagDocument> {
  const safeName = safeFileName(input.fileName);
  const storagePath =
    `${input.organizationId}/rag/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(RAG_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.mimeType || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .schema('enterprise')
    .from('rag_documents')
    .insert({
      organization_id: input.organizationId,
      title: input.title.trim(),
      source_type: 'file',
      category: input.category,
      document_type: input.documentType ?? null,
      storage_path: uploadData.path,
      content: null,
      metadata: {
        ...(input.metadata ?? {}),
        original_file_name: input.fileName,
      },
      processing_status: 'stored',
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size: input.fileSize ?? null,
      error_message: null,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(RAG_BUCKET).remove([storagePath]);
    throw error;
  }

  return data as RagDocument;
}

export async function processRagDocument(
  documentId: string,
): Promise<{
  document_id: string;
  chunks: number;
  status: string;
}> {
  const { data, error } = await supabase.functions.invoke('enterprise-rag', {
    body: {
      action: 'process_document',
      document_id: documentId,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data as {
    document_id: string;
    chunks: number;
    status: string;
  };
}

export async function createRagDocumentSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RAG_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;

  return data.signedUrl;
}

export async function searchRag(
  input: RagSearchInput,
): Promise<RagResult[]> {
  const { data, error } = await supabase.functions.invoke('enterprise-rag', {
    body: {
      action: 'search',
      organization_id: input.organizationId,
      query: input.query,
      category: input.category ?? null,
      threshold: input.threshold ?? 0.70,
      limit: input.limit ?? 8,
    },
  });

  if (error) throw error;

  return (data?.results ?? []) as RagResult[];
}

export async function listRagDocuments(
  organizationId: string,
): Promise<RagDocument[]> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('rag_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as RagDocument[];
}

export async function archiveRagDocument(
  organizationId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('rag_documents')
    .update({ status: 'archived' })
    .eq('id', documentId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw error;

  return data as RagDocument;
}
