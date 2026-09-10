import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFParse } from 'npm:pdf-parse@2.4.5'
import * as mammoth from 'npm:mammoth@1.12.2'

const model = new Supabase.ai.Session('gte-small')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')
const publishableKey =
  publishableKeys.default ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

const BUCKET = 'enterprise-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024

function chunkText(text: string, size = 1200, overlap = 150) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    const end = Math.min(start + size, clean.length)
    chunks.push(clean.slice(start, end))

    if (end === clean.length) break

    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: auth } },
  })

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

async function assertMember(
  supabase: any,
  organizationId: string,
  userId: string,
) {
  const {
    data: member,
    error,
  } = await supabase
    .schema('enterprise')
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error || !member) {
    throw new Error('Accès organisation refusé')
  }
}

async function extractText(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
) {
  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    return new TextDecoder().decode(bytes)
  }

  if (
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf')
  ) {
    const parser = new PDFParse({ data: bytes })

    try {
      return (await parser.getText()).text
    } finally {
      await parser.destroy()
    }
  }

  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.toLowerCase().endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({
      arrayBuffer: bytes.buffer,
    })

    return result.value
  }

  if (mimeType.startsWith('image/')) {
    throw new Error(
      'OCR requis pour les images. Le moteur OCR sera activé dans une étape dédiée.',
    )
  }

  throw new Error(
    `Type de fichier non pris en charge pour extraction: ${mimeType}`,
  )
}

async function indexDocument(
  supabase: any,
  documentId: string,
  organizationId: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  const chunks = chunkText(content)

  await supabase
    .schema('enterprise')
    .from('rag_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', organizationId)

  const rows = []

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await model.run(chunks[i], {
      mean_pool: true,
      normalize: true,
    })

    rows.push({
      organization_id: organizationId,
      document_id: documentId,
      chunk_index: i,
      content: chunks[i],
      embedding: Array.from(embedding),
      metadata,
    })
  }

  if (rows.length) {
    const { error } = await supabase
      .schema('enterprise')
      .from('rag_chunks')
      .insert(rows)

    if (error) {
      throw new Error(error.message)
    }
  }

  return rows.length
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST requis' }, 405)
  }

  try {
    const { supabase, user } = await requireUser(req)
    const body = await req.json()
    const action = body.action ?? 'ingest'

    if (action === 'ingest') {
      const {
        organization_id,
        title,
        content,
        category = 'general',
        document_type = null,
        source_type = 'manual',
        storage_path = null,
        metadata = {},
      } = body

      if (!organization_id || !title || !content) {
        return json(
          { error: 'organization_id, title et content requis' },
          400,
        )
      }

      await assertMember(supabase, organization_id, user.id)

      const {
        data: doc,
        error: docError,
      } = await supabase
        .schema('enterprise')
        .from('rag_documents')
        .insert({
          organization_id,
          title,
          content,
          category,
          document_type,
          source_type,
          storage_path,
          metadata,
          processing_status: 'pending_indexing',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (docError) {
        return json({ error: docError.message }, 400)
      }

      try {
        const chunks = await indexDocument(
          supabase,
          doc.id,
          organization_id,
          content,
          {
            ...metadata,
            category,
            document_type,
            source_type,
          },
        )

        await supabase
          .schema('enterprise')
          .from('rag_documents')
          .update({
            processing_status: 'indexed',
            error_message: null,
          })
          .eq('id', doc.id)

        return json({
          document_id: doc.id,
          chunks,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Erreur d’indexation'

        await supabase
          .schema('enterprise')
          .from('rag_documents')
          .update({
            processing_status: 'error',
            error_message: message,
          })
          .eq('id', doc.id)

        return json(
          {
            error: message,
            document_id: doc.id,
          },
          400,
        )
      }
    }

    if (action === 'process_document') {
      const { document_id } = body

      if (!document_id) {
        return json({ error: 'document_id requis' }, 400)
      }

      const {
        data: doc,
        error: docError,
      } = await supabase
        .schema('enterprise')
        .from('rag_documents')
        .select(
          'id, organization_id, title, storage_path, file_name, mime_type, file_size, category, document_type, source_type, metadata, processing_status',
        )
        .eq('id', document_id)
        .single()

      if (docError || !doc) {
        return json({ error: 'Document introuvable' }, 404)
      }

      await assertMember(
        supabase,
        doc.organization_id,
        user.id,
      )

      if (!doc.storage_path) {
        return json(
          { error: 'Aucun fichier associé au document' },
          400,
        )
      }

      if (doc.file_size && doc.file_size > MAX_FILE_SIZE) {
        return json(
          { error: 'Fichier trop volumineux' },
          400,
        )
      }

      await supabase
        .schema('enterprise')
        .from('rag_documents')
        .update({
          processing_status: 'extracting',
          error_message: null,
        })
        .eq('id', document_id)

      try {
        const {
          data: file,
          error: downloadError,
        } = await supabase.storage
          .from(BUCKET)
          .download(doc.storage_path)

        if (downloadError || !file) {
          throw new Error(
            downloadError?.message ??
              'Impossible de télécharger le fichier',
          )
        }

        const bytes = new Uint8Array(
          await file.arrayBuffer(),
        )

        const content = (
          await extractText(
            bytes,
            doc.mime_type ?? 'application/octet-stream',
            doc.file_name ?? doc.title,
          )
        ).trim()

        if (!content) {
          throw new Error(
            'Aucun texte exploitable trouvé dans le fichier',
          )
        }

        await supabase
          .schema('enterprise')
          .from('rag_documents')
          .update({
            processing_status: 'indexing',
            content,
            error_message: null,
          })
          .eq('id', document_id)

        const chunks = await indexDocument(
          supabase,
          document_id,
          doc.organization_id,
          content,
          {
            ...(doc.metadata ?? {}),
            category: doc.category,
            document_type: doc.document_type,
            source_type: doc.source_type,
            extracted: true,
          },
        )

        await supabase
          .schema('enterprise')
          .from('rag_documents')
          .update({
            processing_status: 'indexed',
            error_message: null,
          })
          .eq('id', document_id)

        return json({
          document_id,
          chunks,
          status: 'indexed',
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Erreur de traitement'

        await supabase
          .schema('enterprise')
          .from('rag_documents')
          .update({
            processing_status: 'error',
            error_message: message,
          })
          .eq('id', document_id)

        return json(
          {
            error: message,
            document_id,
          },
          400,
        )
      }
    }

    if (action === 'search') {
      const {
        organization_id,
        query,
        category = null,
        threshold = 0.70,
        limit = 8,
      } = body

      if (!organization_id || !query) {
        return json(
          { error: 'organization_id et query requis' },
          400,
        )
      }

      await assertMember(
        supabase,
        organization_id,
        user.id,
      )

      const embedding = await model.run(query, {
        mean_pool: true,
        normalize: true,
      })

      const {
        data,
        error,
      } = await supabase
        .schema('enterprise')
        .rpc('search_rag_chunks', {
          p_organization_id: organization_id,
          p_query_embedding: Array.from(embedding),
          p_match_threshold: threshold,
          p_match_count: limit,
          p_category: category,
        })

      if (error) {
        return json({ error: error.message }, 400)
      }

      return json({
        results: data ?? [],
      })
    }

    return json(
      { error: 'Action inconnue' },
      400,
    )
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Erreur interne'

    return json(
      { error: message },
      500,
    )
  }
})
