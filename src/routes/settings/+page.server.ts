import { fail, redirect } from '@sveltejs/kit';
import { setAdminPassword } from '$lib/server/auth';
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
