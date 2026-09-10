import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signIn, signUp } from './lib/auth';
import { supabase } from './lib/supabase';

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function handleLogin() {
    const cleanEmail = email.trim();

    if (!validateEmail(cleanEmail)) {
      Alert.alert('Email invalide', 'Saisis une adresse email valide.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mot de passe invalide', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(cleanEmail, password);
    setLoading(false);

    if (error) {
      Alert.alert('Connexion impossible', error.message);
      return;
    }

    onLogin();
  }

  async function handleSignup() {
    const cleanEmail = email.trim();
    const cleanOrganization = organizationName.trim();

    if (cleanOrganization.length < 2) {
      Alert.alert('Entreprise requise', 'Saisis le nom de ton entreprise.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert('Email invalide', 'Saisis une adresse email valide.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Utilise au moins 6 caractères.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Mots de passe différents', 'Les deux mots de passe doivent être identiques.');
      return;
    }

    setLoading(true);
    const { data, error } = await signUp(cleanEmail, password);

    if (error) {
      setLoading(false);
      Alert.alert('Inscription impossible', error.message);
      return;
    }

    if (!data.session) {
      setLoading(false);
      Alert.alert(
        'Compte créé',
        'Vérifie ton email pour confirmer ton compte, puis connecte-toi.'
      );
      setMode('login');
      setPassword('');
      setPasswordConfirmation('');
      return;
    }

    const { error: organizationError } = await supabase.rpc(
      'create_organization',
      { org_name: cleanOrganization }
    );

    setLoading(false);

    if (organizationError) {
      Alert.alert('Entreprise non créée', organizationError.message);
      return;
    }

    onLogin();
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim();

    if (!validateEmail(cleanEmail)) {
      Alert.alert('Email requis', 'Saisis ton adresse email pour recevoir le lien.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: 'enterprise://auth/reset' });

    setLoading(false);

    if (error) {
      Alert.alert('Réinitialisation impossible', error.message);
      return;
    }

    Alert.alert(
      'Email envoyé',
      'Si cette adresse possède un compte, tu recevras un lien pour réinitialiser ton mot de passe.'
    );
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setPassword('');
    setPasswordConfirmation('');
    setShowPassword(false);
    setShowConfirmation(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>Enterprise</Text>
          <Text style={styles.subtitle}>
            Gérez votre entreprise depuis une seule application.
          </Text>
        </View>

        <View style={styles.card}>
          {!isForgot && (
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => switchMode('login')}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Connexion
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tab, isSignup && styles.activeTab]}
                onPress={() => switchMode('signup')}
              >
                <Text style={[styles.tabText, isSignup && styles.activeTabText]}>
                  Créer un compte
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.title}>
            {isLogin ? 'Bienvenue' : isSignup ? 'Créer votre espace' : 'Mot de passe oublié'}
          </Text>

          <Text style={styles.description}>
            {isLogin
              ? 'Connectez-vous à votre espace entreprise.'
              : isSignup
                ? 'Créez votre entreprise et votre compte administrateur.'
                : 'Saisissez votre email pour recevoir un lien de réinitialisation.'}
          </Text>

          {isSignup && (
            <TextInput
              style={styles.input}
              placeholder="Nom de l'entreprise"
              value={organizationName}
              onChangeText={setOrganizationName}
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email professionnel"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          {!isForgot && (
            <>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Pressable
                  style={styles.visibilityButton}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  <Text style={styles.visibilityText}>
                    {showPassword ? 'Masquer' : 'Afficher'}
                  </Text>
                </Pressable>
              </View>

              {isSignup && (
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirmer le mot de passe"
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    secureTextEntry={!showConfirmation}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <Pressable
                    style={styles.visibilityButton}
                    onPress={() => setShowConfirmation((value) => !value)}
                  >
                    <Text style={styles.visibilityText}>
                      {showConfirmation ? 'Masquer' : 'Afficher'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {isLogin && (
                <Pressable
                  style={styles.forgotButton}
                  onPress={() => switchMode('forgot')}
                  disabled={loading}
                >
                  <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                </Pressable>
              )}
            </>
          )}

          <Pressable
            style={[styles.button, loading && styles.disabledButton]}
            disabled={loading}
            onPress={isLogin ? handleLogin : isSignup ? handleSignup : handleForgotPassword}
          >
            <Text style={styles.buttonText}>
              {loading
                ? 'Veuillez patienter...'
                : isLogin
                  ? 'Se connecter'
                  : isSignup
                    ? 'Créer mon compte'
                    : 'Envoyer le lien'}
            </Text>
          </Pressable>

          {isForgot ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => switchMode('login')}
              disabled={loading}
            >
              <Text style={styles.secondaryText}>Retour à la connexion</Text>
            </Pressable>
          ) : isLogin ? (
            <Text style={styles.bottomText}>
              Pas encore de compte ?{' '}
              <Text style={styles.link} onPress={() => switchMode('signup')}>
                Créer un compte
              </Text>
            </Text>
          ) : (
            <Text style={styles.bottomText}>
              Vous avez déjà un compte ?{' '}
              <Text style={styles.link} onPress={() => switchMode('login')}>
                Se connecter
              </Text>
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: '#F6F7FB' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: { marginBottom: 28 },
  logo: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#6B7280' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#111827' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  description: { marginTop: 7, marginBottom: 20, color: '#6B7280', lineHeight: 20 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    color: '#111827',
  },
  visibilityButton: { paddingHorizontal: 12 },
  visibilityText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  forgotButton: { alignSelf: 'flex-end', marginBottom: 18 },
  forgotText: { color: '#2563EB', fontWeight: '600' },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  secondaryText: { color: '#374151', fontWeight: '600' },
  bottomText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 21,
  },
  link: { color: '#2563EB', fontWeight: '700' },
});
