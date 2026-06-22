import { fail, redirect } from '@sveltejs/kit';
import { setAdminPassword, verifyAdminPassword } from '$lib/server/auth';
import {
  allowExternalSignOnLink,
  clearExternalSignOnIdentity,
  externalSignOnRedirectUri,
  getExternalSignOnStatus,
  isExternalSignOnProvider,
  updateExternalSignOnProviderSettings,
  type ExternalSignOnProvider
} from '$lib/server/external-sign-on';
import { listAiModels } from '$lib/server/llm';
import { required } from '$lib/server/form-utils';
import { testSmtpSettings } from '$lib/server/mailer';
import { loadSettingsData } from '$lib/server/page-data';
import { aiApiKeyForModelLoad, getSettings, getAiApiKey } from '$lib/server/settings';
import {
  updateAgentAccessSettings,
  updateAgentPermissionSettings,
  updateAiSettings,
  updateDeliverySettings,
  updateProfileSettings,
  updateRemoteAccessSettings,
  updateSmtpSettings,
  updateVocabularySettings
} from '$lib/server/settings';

export const load = ({ url }) => {
  const data = loadSettingsData();
  return {
    ...data,
    message: url.searchParams.get('message') ?? '',
    openSection: url.searchParams.get('section') ?? '',
    externalSignOnLinked: url.searchParams.get('externalSignOn') === 'linked',
    externalSignOn: getExternalSignOnStatus(),
    externalSignOnRedirectUris: {
      google: externalSignOnRedirectUri(url.origin, 'google'),
      entra: externalSignOnRedirectUri(url.origin, 'entra')
    },
    microsoftRedirectUri: `${(data.settings.publicBaseUrl || url.origin).replace(/\/$/, '')}/settings/microsoft/callback`
  };
};

export const actions = {
  updateProfile: async ({ request }) => {
    updateProfileSettings(await request.formData());
    return { message: 'Profile settings saved.' };
  },
  updateDelivery: async ({ request }) => {
    updateDeliverySettings(await request.formData());
    return { message: 'Delivery settings saved.' };
  },
  updateRemoteAccess: async ({ request }) => {
    updateRemoteAccessSettings(await request.formData());
    return { message: 'Remote access settings saved.' };
  },
  updateSmtp: async ({ request }) => {
    updateSmtpSettings(await request.formData());
    return { message: 'SMTP settings saved.' };
  },
  updateAi: async ({ request }) => {
    updateAiSettings(await request.formData());
    return { message: 'AI settings saved.' };
  },
  updateAgentAccess: async ({ request }) => {
    updateAgentAccessSettings(await request.formData());
    return { message: 'Agent access settings saved.' };
  },
  updateAgentPermissions: async ({ request }) => {
    updateAgentPermissionSettings(await request.formData());
    return { message: 'Agent permissions saved.' };
  },
  updateVocabulary: async ({ request }) => {
    updateVocabularySettings(await request.formData());
    return { message: 'Vocabulary settings saved.' };
  },
  saveExternalSignOnProvider: async ({ request }) => {
    const form = await request.formData();
    if (!verifyAdminPassword(String(form.get('currentPassword') ?? ''))) {
      return fail(400, { message: 'Enter the current local admin password before saving external sign-on settings.' });
    }

    try {
      updateExternalSignOnProviderSettings(externalSignOnProviderSettingsFromForm(form));
      return { message: 'External sign-on provider settings saved.' };
    } catch {
      return fail(400, { message: 'Choose Google or Microsoft Entra ID and enter the provider settings.' });
    }
  },
  connectExternalSignOn: async ({ request, cookies }) => {
    const form = await request.formData();
    if (!verifyAdminPassword(String(form.get('currentPassword') ?? ''))) {
      return fail(400, { message: 'Enter the current local admin password before connecting external sign-on.' });
    }

    let provider: ExternalSignOnProvider;
    let settingsInput: ReturnType<typeof externalSignOnProviderSettingsFromForm>;
    try {
      settingsInput = externalSignOnProviderSettingsFromForm(form);
      if (!isExternalSignOnProvider(settingsInput.provider)) {
        return fail(400, { message: 'Choose Google or Microsoft Entra ID before connecting external sign-on.' });
      }
      provider = settingsInput.provider;
    } catch {
      return fail(400, { message: 'Check the selected provider settings before connecting external sign-on.' });
    }

    const status = getExternalSignOnStatus();
    if (!externalSignOnProviderInputIsConfigured(settingsInput, status, provider)) {
      return fail(400, { message: 'Enter the selected provider client ID and client secret before connecting external sign-on.' });
    }

    try {
      updateExternalSignOnProviderSettings(settingsInput);
    } catch {
      return fail(400, { message: 'Check the selected provider settings before connecting external sign-on.' });
    }

    allowExternalSignOnLink(cookies);
    throw redirect(303, `/auth/external/${provider}/start?mode=link`);
  },
  removeExternalSignOn: async ({ request }) => {
    const form = await request.formData();
    if (!verifyAdminPassword(String(form.get('currentPassword') ?? ''))) {
      return fail(400, { message: 'Enter the current local admin password before removing external sign-on.' });
    }

    clearExternalSignOnIdentity();
    return { message: 'External sign-on link removed. Provider settings were kept.' };
  },
  loadAiModels: async ({ request }) => {
    const form = await request.formData();
	    const baseUrl = String(form.get('aiBaseUrl') ?? '');
	    const postedApiKey = String(form.get('aiApiKey') ?? '');
	    const settings = getSettings();
	    try {
	      const models = await listAiModels({
	        baseUrl,
	        apiKey: aiApiKeyForModelLoad(baseUrl, postedApiKey, settings, getAiApiKey())
	      });
      if (!models.length) return fail(400, { message: 'AI endpoint did not return any models.', aiBaseUrl: baseUrl });
      return {
        message: `Loaded ${models.length} model${models.length === 1 ? '' : 's'} from the AI endpoint.`,
        aiModels: models,
        aiBaseUrl: baseUrl,
        aiModel: String(form.get('aiModel') ?? '')
      };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : String(error),
        aiBaseUrl: baseUrl,
        aiModel: String(form.get('aiModel') ?? '')
      });
    }
  },
  saveAndConnectMicrosoft: async ({ request }) => {
    updateSmtpSettings(await request.formData());
    throw redirect(303, '/settings/microsoft/start');
  },
  testSmtp: async ({ request }) => {
    const form = await request.formData();
    try {
      const providerMessage = await testSmtpSettings(required(form, 'testEmail'));
      return { message: `SMTP accepted the test email: ${providerMessage}` };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : String(error) });
    }
  },
  changePassword: async ({ request }) => {
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    if (password.length < 10) return fail(400, { message: 'Use at least 10 characters.' });
    setAdminPassword(password);
    return { message: 'Admin password updated.' };
  }
};

function externalSignOnProviderSettingsFromForm(form: FormData) {
  return {
    provider: String(form.get('externalSignOnProvider') ?? ''),
    googleClientId: String(form.get('googleClientId') ?? ''),
    googleClientSecret: String(form.get('googleClientSecret') ?? ''),
    entraTenant: String(form.get('entraTenant') ?? ''),
    entraClientId: String(form.get('entraClientId') ?? ''),
    entraClientSecret: String(form.get('entraClientSecret') ?? '')
  };
}

function externalSignOnProviderInputIsConfigured(
  input: ReturnType<typeof externalSignOnProviderSettingsFromForm>,
  status: ReturnType<typeof getExternalSignOnStatus>,
  provider: ExternalSignOnProvider
) {
  if (provider === 'google') {
    return Boolean(clean(input.googleClientId) && (clean(input.googleClientSecret) || canPreserveGoogleSecret(input, status)));
  }
  return Boolean(clean(input.entraClientId) && (clean(input.entraClientSecret) || canPreserveEntraSecret(input, status)));
}

function canPreserveGoogleSecret(
  input: ReturnType<typeof externalSignOnProviderSettingsFromForm>,
  status: ReturnType<typeof getExternalSignOnStatus>
) {
  return status.provider === 'google'
    && status.googleClientSecretConfigured
    && clean(input.googleClientId) === clean(status.googleClientId);
}

function canPreserveEntraSecret(
  input: ReturnType<typeof externalSignOnProviderSettingsFromForm>,
  status: ReturnType<typeof getExternalSignOnStatus>
) {
  return status.provider === 'entra'
    && status.entraClientSecretConfigured
    && clean(input.entraClientId) === clean(status.entraClientId)
    && (clean(input.entraTenant) || 'common') === (clean(status.entraTenant) || 'common');
}

function clean(value: string) {
  return value.trim();
}
