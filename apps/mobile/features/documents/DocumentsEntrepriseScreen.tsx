import React, { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CompanyDocumentSettings,
  DocumentTemplate,
  DocumentType,
  createDocumentTemplate,
  getCompanyDocumentSettings,
  listDocumentTemplates,
  saveCompanyDocumentSettings,
  setDefaultDocumentTemplate,
  archiveDocumentTemplate,
} from '../../lib/documentTemplates';
import { usePermissions } from '../../lib/PermissionsContext';
import {
  RagDocument,
  RagDocumentCategory,
  archiveRagDocument,
  listRagDocuments,
  processRagDocument,
  uploadRagDocumentFile,
} from '../../lib/rag';

type Props = {
  onBack: () => void;
};

type SettingsForm = {
  legal_name: string;
  trade_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
  registration_id: string;
  default_currency: string;
  payment_terms: string;
  legal_mentions: string;
  default_notes: string;
};

const emptySettings: SettingsForm = {
  legal_name: '',
  trade_name: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  tax_id: '',
  registration_id: '',
  default_currency: 'XAF',
  payment_terms: '',
  legal_mentions: '',
  default_notes: '',
};

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea]}
        placeholder="—"
        placeholderTextColor="#A3A3A3"
      />
    </View>
  );
}

function TemplateCard({
  template,
  canEdit,
  canDelete,
  onDefault,
  onArchive,
}: {
  template: DocumentTemplate;
  canEdit: boolean;
  canDelete: boolean;
  onDefault: () => void;
  onArchive: () => void;
}) {
  return (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateTitleWrap}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateType}>
            {template.document_type === 'quote' ? 'Devis' : 'Facture'}
          </Text>
        </View>

        {template.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Par défaut</Text>
          </View>
        )}
      </View>

      {template.content ? (
        <Text numberOfLines={4} style={styles.templateContent}>
          {template.content}
        </Text>
      ) : (
        <Text style={styles.templateEmpty}>Aucune instruction définie.</Text>
      )}

      <View style={styles.actions}>
        {canEdit && !template.is_default && (
          <Pressable style={styles.secondaryButton} onPress={onDefault}>
            <Text style={styles.secondaryButtonText}>Définir par défaut</Text>
          </Pressable>
        )}

        {canDelete && (
          <Pressable style={styles.dangerButton} onPress={onArchive}>
            <Text style={styles.dangerButtonText}>Archiver</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}


const RAG_CATEGORIES: Array<{
  value: RagDocumentCategory;
  label: string;
}> = [
  { value: 'procedure', label: 'Procédure' },
  { value: 'template', label: 'Modèle' },
  { value: 'policy', label: 'Politique' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'hr', label: 'RH' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Autre' },
];

function ragCategoryLabel(category: string) {
  return (
    RAG_CATEGORIES.find((item) => item.value === category)?.label ??
    category
  );
}

function ragStatusLabel(status: RagDocument['processing_status']) {
  switch (status) {
    case 'stored':
      return 'Stocké — extraction à venir';
    case 'pending_extraction':
      return 'En attente d’extraction';
    case 'extracting':
      return 'Extraction en cours';
    case 'pending_indexing':
      return 'En attente d’indexation';
    case 'indexing':
      return 'Indexation en cours';
    case 'indexed':
      return 'Indexé';
    case 'error':
      return 'Erreur de traitement';
    default:
      return 'En attente';
  }
}

function RagDocumentCard({
  document,
  canDelete,
  onArchive,
}: {
  document: RagDocument;
  canDelete: boolean;
  onArchive: () => void;
}) {
  return (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateTitleWrap}>
          <Text style={styles.templateName}>{document.title}</Text>
          <Text style={styles.templateType}>
            {ragCategoryLabel(document.category)}
            {document.mime_type ? ` · ${document.mime_type}` : ''}
          </Text>
        </View>
        <View style={styles.documentStatusBadge}>
          <Text style={styles.documentStatusText}>
            {ragStatusLabel(document.processing_status)}
          </Text>
        </View>
      </View>

      {document.file_name && (
        <Text style={styles.templateContent} numberOfLines={2}>
          {document.file_name}
        </Text>
      )}

      {document.error_message && (
        <Text style={styles.documentError}>
          {document.error_message}
        </Text>
      )}

      {canDelete && (
        <View style={styles.actions}>
          <Pressable style={styles.dangerButton} onPress={onArchive}>
            <Text style={styles.dangerButtonText}>Archiver</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function DocumentsEntrepriseScreen({ onBack }: Props) {
  const { organizationId, can } = usePermissions();

  const [settings, setSettings] = useState<CompanyDocumentSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(emptySettings);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [newTemplateType, setNewTemplateType] =
    useState<DocumentType>('quote');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [newTemplateDefault, setNewTemplateDefault] = useState(false);
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [newDocumentCategory, setNewDocumentCategory] =
    useState<RagDocumentCategory>('procedure');

  const canViewProfile = can('profile', 'view');
  const canEditProfile = can('profile', 'edit');
  const canViewFinance = can('finance', 'view');
  const canCreateFinance = can('finance', 'create');
  const canEditFinance = can('finance', 'edit');
  const canDeleteFinance = can('finance', 'delete');

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const currentOrganizationId = organizationId;
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [company, documentTemplates, knowledgeDocuments] =
          await Promise.all([
            getCompanyDocumentSettings(currentOrganizationId),
            listDocumentTemplates(currentOrganizationId),
            listRagDocuments(currentOrganizationId),
          ]);

        if (!active) return;

        setSettings(company);

        if (company) {
          setForm({
            legal_name: company.legal_name ?? '',
            trade_name: company.trade_name ?? '',
            address: company.address ?? '',
            phone: company.phone ?? '',
            email: company.email ?? '',
            website: company.website ?? '',
            tax_id: company.tax_id ?? '',
            registration_id: company.registration_id ?? '',
            default_currency: company.default_currency ?? 'XAF',
            payment_terms: company.payment_terms ?? '',
            legal_mentions: company.legal_mentions ?? '',
            default_notes: company.default_notes ?? '',
          });
        }

        setTemplates(documentTemplates);
        setRagDocuments(knowledgeDocuments);
      } catch (error) {
        if (active) {
          Alert.alert(
            'Erreur',
            error instanceof Error
              ? error.message
              : 'Impossible de charger les documents.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [organizationId]);

  function updateField(field: keyof SettingsForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings() {
    if (!organizationId || !canEditProfile) return;

    setSavingSettings(true);

    try {
      const result = await saveCompanyDocumentSettings({
        organizationId,
        legalName: form.legal_name.trim() || null,
        tradeName: form.trade_name.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        taxId: form.tax_id.trim() || null,
        registrationId: form.registration_id.trim() || null,
        defaultCurrency: form.default_currency.trim() || 'XAF',
        paymentTerms: form.payment_terms.trim() || null,
        legalMentions: form.legal_mentions.trim() || null,
        defaultNotes: form.default_notes.trim() || null,
      });

      setSettings(result);
      Alert.alert('Enregistré', 'Les informations documentaires ont été mises à jour.');
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer les informations.',
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function refreshTemplates() {
    if (!organizationId) return;

    const refreshed = await listDocumentTemplates(organizationId);
    setTemplates(refreshed);
  }


  async function refreshRagDocuments() {
    if (!organizationId) return;
    const refreshed = await listRagDocuments(organizationId);
    setRagDocuments(refreshed);
  }

  async function importRagDocument() {
    if (!organizationId || !canEditProfile) return;

    setUploadingDocument(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/csv',
          'image/png',
          'image/jpeg',
          'image/webp',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.uri) {
        throw new Error('Le fichier sélectionné est inaccessible.');
      }

      const arrayBuffer = await fetch(asset.uri).then((response) => {
        if (!response.ok) {
          throw new Error('Impossible de lire le fichier sélectionné.');
        }
        return response.arrayBuffer();
      });

      const document = await uploadRagDocumentFile({
        organizationId,
        title: asset.name,
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        fileSize: asset.size ?? arrayBuffer.byteLength,
        file: arrayBuffer,
        category: newDocumentCategory,
      });

      await refreshRagDocuments();

      try {
        const processed = await processRagDocument(document.id);

        await refreshRagDocuments();

        Alert.alert(
          'Document indexé',
          `Le document est disponible pour le RAG (${processed.chunks} segment${processed.chunks > 1 ? 's' : ''}).`,
        );
      } catch (processingError) {
        await refreshRagDocuments();

        Alert.alert(
          'Document stocké',
          processingError instanceof Error
            ? `Le fichier est sécurisé, mais son traitement a échoué : ${processingError.message}`
            : 'Le fichier est sécurisé, mais son traitement a échoué.',
        );
      }

      await refreshRagDocuments();

      Alert.alert(
        'Document importé',
        'Le fichier est sécurisé dans l’espace documentaire de l’entreprise. L’extraction et l’indexation RAG seront effectuées dans l’étape suivante.',
      );
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error
          ? error.message
          : 'Impossible d’importer le document.',
      );
    } finally {
      setUploadingDocument(false);
    }
  }

  function confirmArchiveRagDocument(document: RagDocument) {
    if (!organizationId || !canEditProfile) return;

    Alert.alert(
      'Archiver le document',
      `Voulez-vous archiver « ${document.title} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveRagDocument(organizationId, document.id);
              await refreshRagDocuments();
            } catch (error) {
              Alert.alert(
                'Erreur',
                error instanceof Error
                  ? error.message
                  : 'Impossible d’archiver le document.',
              );
            }
          },
        },
      ],
    );
  }

  async function createTemplate() {
    if (
      !organizationId ||
      !canCreateFinance ||
      !newTemplateName.trim() ||
      !newTemplateContent.trim()
    ) {
      Alert.alert(
        'Informations manquantes',
        'Renseignez le nom et les instructions du modèle.',
      );
      return;
    }

    setSavingTemplate(true);

    try {
      await createDocumentTemplate({
        organizationId,
        documentType: newTemplateType,
        name: newTemplateName.trim(),
        content: newTemplateContent.trim(),
        isDefault: newTemplateDefault,
      });

      setNewTemplateName('');
      setNewTemplateContent('');
      setNewTemplateDefault(false);

      await refreshTemplates();

      Alert.alert('Modèle créé', 'Le modèle documentaire a été enregistré.');
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error
          ? error.message
          : 'Impossible de créer le modèle.',
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  async function makeDefault(template: DocumentTemplate) {
    if (!organizationId || !canEditFinance) return;

    try {
      await setDefaultDocumentTemplate(
        organizationId,
        template.id,
        template.document_type,
      );

      await refreshTemplates();
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error
          ? error.message
          : 'Impossible de définir le modèle par défaut.',
      );
    }
  }

  function confirmArchive(template: DocumentTemplate) {
    if (!organizationId || !canDeleteFinance) return;

    Alert.alert(
      'Archiver le modèle',
      `Voulez-vous archiver « ${template.name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveDocumentTemplate(organizationId, template.id);
              await refreshTemplates();
            } catch (error) {
              Alert.alert(
                'Erreur',
                error instanceof Error
                  ? error.message
                  : 'Impossible d’archiver le modèle.',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Chargement…</Text>
      </View>
    );
  }

  if (!organizationId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Documents entreprise</Text>
        <Text style={styles.muted}>Aucune entreprise associée à ce compte.</Text>
        <Pressable style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Retour</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Documents entreprise</Text>
      <Text style={styles.subtitle}>
        Informations, règles et modèles utilisés pour les devis et factures.
      </Text>

      {canViewProfile && (
        <>
          <Text style={styles.section}>IDENTITÉ DE L’ENTREPRISE</Text>

          <View style={styles.card}>
            <Field
              label="Raison sociale"
              value={form.legal_name}
              editable={canEditProfile}
              onChangeText={(value) => updateField('legal_name', value)}
            />
            <Field
              label="Nom commercial"
              value={form.trade_name}
              editable={canEditProfile}
              onChangeText={(value) => updateField('trade_name', value)}
            />
            <Field
              label="Adresse"
              value={form.address}
              editable={canEditProfile}
              multiline
              onChangeText={(value) => updateField('address', value)}
            />
            <Field
              label="Téléphone"
              value={form.phone}
              editable={canEditProfile}
              onChangeText={(value) => updateField('phone', value)}
            />
            <Field
              label="Email"
              value={form.email}
              editable={canEditProfile}
              onChangeText={(value) => updateField('email', value)}
            />
            <Field
              label="Site web"
              value={form.website}
              editable={canEditProfile}
              onChangeText={(value) => updateField('website', value)}
            />
            <Field
              label="N° fiscal"
              value={form.tax_id}
              editable={canEditProfile}
              onChangeText={(value) => updateField('tax_id', value)}
            />
            <Field
              label="N° d’immatriculation"
              value={form.registration_id}
              editable={canEditProfile}
              onChangeText={(value) => updateField('registration_id', value)}
            />
            <Field
              label="Devise"
              value={form.default_currency}
              editable={canEditProfile}
              onChangeText={(value) => updateField('default_currency', value)}
            />

            {canEditProfile && (
              <Pressable
                style={styles.primaryButton}
                onPress={saveSettings}
                disabled={savingSettings}
              >
                <Text style={styles.primaryButtonText}>
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {canViewProfile && (
        <>
          <Text style={styles.section}>RÈGLES DOCUMENTAIRES</Text>

          <View style={styles.card}>
            <Field
              label="Conditions de paiement"
              value={form.payment_terms}
              editable={canEditProfile}
              multiline
              onChangeText={(value) => updateField('payment_terms', value)}
            />
            <Field
              label="Mentions légales"
              value={form.legal_mentions}
              editable={canEditProfile}
              multiline
              onChangeText={(value) => updateField('legal_mentions', value)}
            />
            <Field
              label="Notes par défaut"
              value={form.default_notes}
              editable={canEditProfile}
              multiline
              onChangeText={(value) => updateField('default_notes', value)}
            />
          </View>
        </>
      )}

      {canViewProfile && (
        <>
          <Text style={styles.section}>DOCUMENTS DE CONNAISSANCE RAG</Text>

          {ragDocuments.map((document) => (
            <RagDocumentCard
              key={document.id}
              document={document}
              canDelete={canEditProfile}
              onArchive={() => confirmArchiveRagDocument(document)}
            />
          ))}

          {ragDocuments.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>
                Aucun document de connaissance importé.
              </Text>
            </View>
          )}

          {canEditProfile && (
            <View style={styles.card}>
              <Text style={styles.label}>Catégorie du document</Text>

              <View style={styles.categoryGrid}>
                {RAG_CATEGORIES.map((category) => (
                  <Pressable
                    key={category.value}
                    style={[
                      styles.categoryButton,
                      newDocumentCategory === category.value &&
                        styles.categoryButtonActive,
                    ]}
                    onPress={() => setNewDocumentCategory(category.value)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        newDocumentCategory === category.value &&
                          styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={styles.primaryButton}
                onPress={importRagDocument}
                disabled={uploadingDocument}
              >
                <Text style={styles.primaryButtonText}>
                  {uploadingDocument
                    ? 'Importation…'
                    : 'Importer un document'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Pipeline documentaire</Text>
            <Text style={styles.infoText}>
              Les fichiers sont d’abord stockés de manière privée. Leur
              extraction de texte, puis leur indexation RAG, seront traitées
              côté serveur afin que l’IA puisse ensuite les utiliser.
            </Text>
          </View>
        </>
      )}

      {canViewFinance && (
        <>
          <Text style={styles.section}>MODÈLES DE DEVIS ET FACTURES</Text>

          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              canEdit={canEditFinance}
              canDelete={canDeleteFinance}
              onDefault={() => makeDefault(template)}
              onArchive={() => confirmArchive(template)}
            />
          ))}

          {templates.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>
                Aucun modèle documentaire actif.
              </Text>
            </View>
          )}

          {canCreateFinance && (
            <>
              <Text style={styles.section}>NOUVEAU MODÈLE</Text>

              <View style={styles.card}>
                <Text style={styles.label}>Type de document</Text>

                <View style={styles.typeRow}>
                  <Pressable
                    style={[
                      styles.typeButton,
                      newTemplateType === 'quote' && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewTemplateType('quote')}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        newTemplateType === 'quote' &&
                          styles.typeButtonTextActive,
                      ]}
                    >
                      Devis
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeButton,
                      newTemplateType === 'invoice' &&
                        styles.typeButtonActive,
                    ]}
                    onPress={() => setNewTemplateType('invoice')}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        newTemplateType === 'invoice' &&
                          styles.typeButtonTextActive,
                      ]}
                    >
                      Facture
                    </Text>
                  </Pressable>
                </View>

                <Field
                  label="Nom du modèle"
                  value={newTemplateName}
                  onChangeText={setNewTemplateName}
                />

                <Field
                  label="Instructions / contenu du modèle"
                  value={newTemplateContent}
                  multiline
                  onChangeText={setNewTemplateContent}
                />

                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setNewTemplateDefault((current) => !current)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      newTemplateDefault && styles.checkboxActive,
                    ]}
                  >
                    {newTemplateDefault && (
                      <Text style={styles.checkboxMark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxText}>
                    Utiliser comme modèle par défaut
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  onPress={createTemplate}
                  disabled={savingTemplate}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingTemplate ? 'Création…' : 'Créer le modèle'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Préparation RAG</Text>
            <Text style={styles.infoText}>
              Les modèles documentaires pourront ensuite être enrichis avec
              les documents fournis par l’entreprise afin que l’IA respecte
              son format, ses mentions et ses règles lors de la génération.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F7F5',
  },
  topBar: {
    marginBottom: 8,
  },
  back: {
    fontSize: 15,
    color: '#171717',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#171717',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 24,
    fontSize: 14,
    lineHeight: 20,
    color: '#737373',
  },
  section: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#737373',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  field: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#171717',
    fontSize: 15,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 46,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#171717',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#8A3B3B',
    fontSize: 12,
    fontWeight: '600',
  },
  templateCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  templateTitleWrap: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  templateType: {
    marginTop: 3,
    fontSize: 12,
    color: '#737373',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B6B50',
  },
  templateContent: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: '#737373',
  },
  templateEmpty: {
    marginTop: 12,
    fontSize: 13,
    color: '#A3A3A3',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  documentStatusBadge: {
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  documentStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B6B50',
  },
  documentError: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#8A3B3B',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  categoryButtonActive: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  categoryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  typeButtonActive: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#737373',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4D4D4',
  },
  checkboxActive: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: '#171717',
  },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F0F0EE',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#171717',
  },
  infoText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#737373',
  },
  muted: {
    fontSize: 14,
    color: '#737373',
    textAlign: 'center',
  },
});
