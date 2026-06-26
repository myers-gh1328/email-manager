import { fail } from '@sveltejs/kit';
import { repo } from '$lib/server/app';
import { syncDefaultCampaignsForClass, syncDefaultCampaignsForCourseType } from '$lib/server/class-default-campaigns';
import { errorText, required, text } from '$lib/server/form-utils';
import { loadClassesData } from '$lib/server/page-data';

export const load = ({ url }) => {
  const selectedCourseId = url.searchParams.get('courseId') ?? '';
  const selectedLocationId = url.searchParams.get('locationId') ?? '';
  return {
    ...loadClassesData({
      search: url.searchParams.get('search') ?? '',
      page: Number(url.searchParams.get('page') ?? '1')
    }),
    action: url.searchParams.get('action') ?? '',
    tab: url.searchParams.get('tab') ?? (url.searchParams.get('action') === 'course' ? 'courses' : 'sessions'),
    checklistItems: repo.listChecklistItems(),
    selectedCourseId,
    selectedCourse: selectedCourseId ? repo.getCourseType(selectedCourseId) : undefined,
    selectedCourseDefaults: selectedCourseId ? repo.listCourseTypeDefaultTemplates(selectedCourseId) : [],
    selectedCourseChecklistItems: selectedCourseId ? repo.listCourseTypeChecklistItems(selectedCourseId) : [],
    selectedLocationId,
    selectedLocation: selectedLocationId ? repo.getLocation(selectedLocationId) : undefined
  };
};

export const actions = {
  createCourse: async ({ request }) => {
    const form = await request.formData();
    repo.createCourseType({ name: required(form, 'name'), description: text(form, 'description') });
    return { message: 'Course type added.' };
  },
  updateCourse: async ({ request }) => {
    const form = await request.formData();
    repo.updateCourseType(required(form, 'courseId'), { name: required(form, 'name'), description: text(form, 'description') });
    return { message: 'Course type updated.' };
  },
  saveCourseDefaults: async ({ request }) => {
    const form = await request.formData();
    const courseTypeId = required(form, 'courseId');
    for (const purpose of ['welcome', 'reminder', 'pre_class_details', 'follow_up']) {
      const templateId = text(form, purpose);
      if (templateId) {
        repo.setCourseTypeDefaultTemplate({
          courseTypeId,
          purpose,
          templateId,
          sortOrder: defaultPurposeOrder(purpose),
          sendOffsetMinutes: sendOffsetMinutes(form, purpose)
        });
      } else {
        repo.removeCourseTypeDefaultTemplate({ courseTypeId, purpose });
      }
    }
    const sync = syncDefaultCampaignsForCourseType(repo, courseTypeId);
    return {
      message: courseDefaultsMessage(sync)
    };
  },
  createChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.createChecklistItem({ label: required(form, 'label') });
    return { message: 'Prep task added.' };
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
  createCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.createCourseTypeChecklistItem({ courseTypeId: required(form, 'courseId'), label: required(form, 'label') });
    return { message: 'Course checklist item added.' };
  },
  updateCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.updateCourseTypeChecklistItem(required(form, 'itemId'), { label: required(form, 'label') });
    return { message: 'Course checklist item updated.' };
  },
  deleteCourseTypeChecklistItem: async ({ request }) => {
    const form = await request.formData();
    repo.deleteCourseTypeChecklistItem(required(form, 'itemId'));
    return { message: 'Course checklist item deleted.' };
  },
  createLocation: async ({ request }) => {
    const form = await request.formData();
    repo.createLocation(locationInput(form));
    return { message: 'Location added.' };
  },
  updateLocation: async ({ request }) => {
    const form = await request.formData();
    repo.updateLocation(required(form, 'locationId'), locationInput(form));
    return { message: 'Location updated.' };
  },
  createClassSession: async ({ request }) => {
    const form = await request.formData();
    const startsOn = required(form, 'startsOn');
    let session;
    try {
      session = repo.createClassSession({
        courseTypeId: required(form, 'courseTypeId'),
        locationId: required(form, 'locationId'),
        startsOn,
        endsOn: text(form, 'endsOn') || startsOn,
        startTime: text(form, 'startTime'),
        location: text(form, 'locationName'),
        notes: text(form, 'notes')
      });
    } catch (error) {
      return fail(400, { error: true, message: classActionError(error) });
    }
    const createdDefaults = syncDefaultCampaignsForClass(repo, session.id);
    return {
      message: classCreatedMessage(createdDefaults.length)
    };
  },
  enrollContact: async ({ request }) => {
    const form = await request.formData();
    repo.enrollContact(required(form, 'classSessionId'), required(form, 'contactId'));
    return { message: 'Student enrolled.' };
  }
};

function defaultPurposeOrder(purpose: string) {
  return ['welcome', 'reminder', 'pre_class_details', 'follow_up'].indexOf(purpose);
}

function sendOffsetMinutes(form: FormData, purpose: string) {
  const rawValue = Number(text(form, `${purpose}OffsetValue`) || '0');
  const value = Number.isFinite(rawValue) ? Math.max(0, Math.trunc(rawValue)) : 0;
  const unit = text(form, `${purpose}OffsetUnit`) === 'hours' ? 'hours' : 'days';
  const direction = text(form, `${purpose}OffsetDirection`) === 'after' ? 'after' : 'before';
  const minutes = value * (unit === 'hours' ? 60 : 24 * 60);
  return direction === 'before' ? -minutes : minutes;
}

function courseDefaultsMessage(sync: { created: number; updated: number; deleted: number; skippedSent: number }) {
  const skipped = sync.skippedSent ? `, skipped ${sync.skippedSent} already-sent` : '';
  return `Course emails updated. Scheduled ${sync.created}, updated ${sync.updated}, removed ${sync.deleted}${skipped}.`;
}

function classCreatedMessage(defaultCampaignCount: number) {
  if (defaultCampaignCount === 0) return 'Class added.';
  const plural = defaultCampaignCount === 1 ? '' : 's';
  return `Class added. Scheduled ${defaultCampaignCount} course email${plural}.`;
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

function classActionError(error: unknown) {
  const message = errorText(error);
  return message.startsWith('Duplicate class session:')
    ? 'A class with that course, date, time, and location already exists.'
    : message;
}
