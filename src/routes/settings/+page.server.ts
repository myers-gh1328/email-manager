import { fail, redirect } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
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
import { syncRepliesNow } from '$lib/server/reply-sync';
import { errorText, formText, required, text } from '$lib/server/form-utils';
import { testSmtpSettings } from '$lib/server/mailer';
import { assertOutboundBatchAllowed } from '$lib/server/outbound-gate';
import { OutboundGateError } from '$lib/server/outbound-errors';
import { loadSettingsData } from '$lib/server/page-data';
import { localReturnTo, returnAfterCreate } from '$lib/server/return-to';
import {
  aiApiKeyForModelLoad,
  getAiApiKey,
  getSettings,
  updateAgentAccessSettings,
  updateAgentPermissionSettings,
  updateAiSettings,
  updateDeliverySettings,
  updateProfileSettings,
  updateRemoteAccessSettings,
  updateReplySyncSettings,
  updateSmtpSettings,
  updateVocabularySettings
} from '$lib/server/settings';

export const load = ({ url }) => {
  const data = loadSettingsData({
    appDataSearch: url.searchParams.get('appDataSearch') ?? '',
    appDataPage: Number(url.searchParams.get('appDataPage') ?? '1')
  });
  return {
    ...data,
    message: url.searchParams.get('message') ?? '',
    openSection: url.searchParams.get('section') ?? '',
    returnTo: localReturnTo(url.searchParams.get('returnTo') ?? ''),
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
    try {
      updateRemoteAccessSettings(await request.formData());
      return { message: 'Remote access settings saved.' };
    } catch (error) {
      return fail(400, { message: errorText(error) });
    }
  },
  updateSmtp: async ({ request }) => {
    updateSmtpSettings(await request.formData());
    return { message: 'SMTP settings saved.' };
  },
  updateAi: async ({ request }) => {
    updateAiSettings(await request.formData());
    return { message: 'AI settings saved.' };
  },
  updateReplySync: async ({ request }) => {
    updateReplySyncSettings(await request.formData());
    return { message: 'Reply sync settings saved.' };
  },
  syncRepliesNow: async () => {
    try {
      const result = await syncRepliesNow();
      if (result.status === 'not_configured') return fail(400, { message: 'Enter IMAP settings before syncing replies.' });
      return { message: `Reply sync checked ${result.checked} recent messages and imported ${result.imported} new replies.` };
    } catch {
      return fail(400, { message: 'Reply sync failed. Check the IMAP settings and try again.' });
    }
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
  createCourse: async ({ request }) => {
    const form = await request.formData();
    repo.createCourseType({ name: required(form, 'name'), description: text(form, 'description') });
    return returnAfterCreate(form, 'Course type added.');
  },
  updateCourse: async ({ request }) => {
    const form = await request.formData();
    repo.updateCourseType(required(form, 'courseId'), { name: required(form, 'name'), description: text(form, 'description') });
    return { message: 'Course type updated.' };
  },
  createLocation: async ({ request }) => {
    const form = await request.formData();
    repo.createLocation(locationInput(form));
    return returnAfterCreate(form, 'Location added.');
  },
  updateLocation: async ({ request }) => {
    const form = await request.formData();
    repo.updateLocation(required(form, 'locationId'), locationInput(form));
    return { message: 'Location updated.' };
  },
  createChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.createChecklistItem({ label: required(form, 'label') });
    return returnAfterCreate(form, 'Prep task added.');
  },
  updateChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.updateChecklistItem(required(form, 'itemId'), { label: required(form, 'label') });
    return { message: 'Prep task updated.' };
  },
  deleteChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.deleteChecklistItem(required(form, 'itemId'));
    return { message: 'Prep task deleted.' };
  },
  saveExternalSignOnProvider: async ({ request }) => {
    const form = await request.formData();
    if (!verifyAdminPassword(formText(form.get('currentPassword')))) {
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
    if (!verifyAdminPassword(formText(form.get('currentPassword')))) {
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
    if (!verifyAdminPassword(formText(form.get('currentPassword')))) {
      return fail(400, { message: 'Enter the current local admin password before removing external sign-on.' });
    }

    clearExternalSignOnIdentity();
    return { message: 'External sign-on link removed. Provider settings were kept.' };
  },
  loadAiModels: async ({ request }) => {
    const form = await request.formData();
	    const baseUrl = formText(form.get('aiBaseUrl'));
	    const postedApiKey = formText(form.get('aiApiKey'));
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
        aiModel: formText(form.get('aiModel'))
      };
    } catch (error) {
      return fail(400, {
        message: errorText(error),
        aiBaseUrl: baseUrl,
        aiModel: formText(form.get('aiModel'))
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
      assertOutboundBatchAllowed({ surface: 'smtp_test', settings: getSettings(), recipientCount: 1 });
      const providerMessage = await testSmtpSettings(required(form, 'testEmail'));
      return { message: `SMTP accepted the test email: ${providerMessage}` };
    } catch (error) {
      if (error instanceof OutboundGateError) return fail(error.retryAfterSeconds ? 429 : 400, { message: error.message });
      return fail(400, { message: errorText(error) });
    }
  },
  changePassword: async ({ request }) => {
    const form = await request.formData();
    if (!verifyAdminPassword(formText(form.get('currentPassword')))) {
      return fail(403, { message: 'Enter the current local admin password before changing the password.' });
    }
    const password = formText(form.get('password'));
    if (password.length < 10) return fail(400, { message: 'Use at least 10 characters.' });
    setAdminPassword(password);
    return { message: 'Admin password updated.' };
  }
};

function externalSignOnProviderSettingsFromForm(form: FormData) {
  return {
    provider: formText(form.get('externalSignOnProvider')),
    googleClientId: formText(form.get('googleClientId')),
    googleClientSecret: formText(form.get('googleClientSecret')),
    entraTenant: formText(form.get('entraTenant')),
    entraClientId: formText(form.get('entraClientId')),
    entraClientSecret: formText(form.get('entraClientSecret'))
  };
}

function locationInput(form: FormData) {
  return {
    name: required(form, 'name'),
    address: text(form, 'address'),
    phone: text(form, 'phone'),
    website: text(form, 'website'),
    parkingNotes: text(form, 'parkingNotes'),
    meetingInstructions: text(form, 'meetingInstructions'),
    notes: text(form, 'notes')
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
