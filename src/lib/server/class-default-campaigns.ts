import type { AppRepository } from './repository';
import { scheduledForFromClassOffset } from './campaign-email';

export function syncDefaultCampaignsForClass(repo: AppRepository, classSessionId: string) {
  const result = syncClass(repo, classSessionId);
  return result.createdCampaigns;
}

export function syncDefaultCampaignsForCourseType(repo: AppRepository, courseTypeId: string) {
  const result = { created: 0, updated: 0, deleted: 0, skippedSent: 0 };
  for (const session of repo.listClassSessions().filter((item) => item.courseTypeId === courseTypeId)) {
    const classResult = syncClass(repo, session.id);
    result.created += classResult.created;
    result.updated += classResult.updated;
    result.deleted += classResult.deleted;
    result.skippedSent += classResult.skippedSent;
  }
  return result;
}

function syncClass(repo: AppRepository, classSessionId: string) {
  const classSession = repo.getClassSession(classSessionId);
  const defaults = repo.listDefaultTemplatesForClassSession(classSessionId);
  const defaultKeys = new Set(defaults.map((item) => defaultKey(item.purpose, item.label)));
  const existingDefaults = new Map(
    repo
      .listCampaignsForClassSession(classSessionId)
      .filter((campaign) => campaign.source === 'course_default')
      .map((campaign) => [defaultKey(campaign.defaultPurpose, campaign.defaultLabel), campaign])
  );
  const result = { created: 0, updated: 0, deleted: 0, skippedSent: 0, createdCampaigns: [] as ReturnType<AppRepository['createCampaign']>[] };

  for (const campaign of existingDefaults.values()) {
    if (defaultKeys.has(defaultKey(campaign.defaultPurpose, campaign.defaultLabel))) continue;
    if (repo.hasSentDeliveries(campaign.id)) {
      result.skippedSent += 1;
    } else {
      repo.deleteCampaign(campaign.id);
      result.deleted += 1;
    }
  }

  for (const defaultTemplate of defaults) {
    const existing = existingDefaults.get(defaultKey(defaultTemplate.purpose, defaultTemplate.label));
    const input = {
      classSessionId,
      templateId: defaultTemplate.templateId,
      name: `${purposeLabel(defaultTemplate.purpose)} · ${defaultTemplate.templateName}`,
      scheduledFor: scheduledForFromClassOffset(classSession, defaultTemplate.sendOffsetMinutes),
      approved: true,
      source: 'course_default' as const,
      defaultPurpose: defaultTemplate.purpose,
      defaultLabel: defaultTemplate.label,
      sendOffsetMinutes: defaultTemplate.sendOffsetMinutes
    };
    if (!existing) {
      const campaign = repo.createCampaign(input);
      repo.ensurePendingDeliveries(campaign.id);
      result.created += 1;
      result.createdCampaigns.push(campaign);
    } else if (
      existing.templateId !== defaultTemplate.templateId ||
      existing.scheduledFor !== input.scheduledFor ||
      existing.sendOffsetMinutes !== defaultTemplate.sendOffsetMinutes
    ) {
      if (repo.hasSentDeliveries(existing.id)) {
        result.skippedSent += 1;
      } else {
        repo.updateDefaultCampaign(existing.id, {
          templateId: input.templateId,
          name: input.name,
          scheduledFor: input.scheduledFor,
          defaultPurpose: input.defaultPurpose,
          defaultLabel: input.defaultLabel,
          sendOffsetMinutes: input.sendOffsetMinutes
        });
        repo.ensurePendingDeliveries(existing.id);
        result.updated += 1;
      }
    }
  }

  return result;
}

function defaultKey(purpose: string, label: string) {
  return `${purpose}:${label}`;
}

function purposeLabel(purpose: string) {
  return purpose
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
