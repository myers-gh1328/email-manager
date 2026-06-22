import { describe, expect, test, vi } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { directEmailPreviewToken, previewDirectEmail, sendDirectEmail } from '../src/lib/server/direct-email';

describe('direct email workflow', () => {
  test('previews personalized freeform email for multiple contacts', () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });

    const previews = previewDirectEmail(repo, {
      contactIds: [maya.id, jo.id],
      subject: 'Hi {{firstName}}',
      body: 'Hello {{fullName}} from {{instructorName}}.',
      instructorName: 'Alex'
    });

    expect(previews).toMatchObject([
      { contact: { id: maya.id }, subject: 'Hi Maya', body: 'Hello Maya Patel from Alex.', missing: [] },
      { contact: { id: jo.id }, subject: 'Hi Jo', body: 'Hello Jo Kim from Alex.', missing: [] }
    ]);
  });

  test('blocks do-not-email contacts before direct SMTP sends', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({
      firstName: 'Maya',
      lastName: 'Patel',
      email: 'maya@example.com',
      doNotEmail: true
    });
    const send = vi.fn();

    await expect(
      sendDirectEmail(repo, send, {
      contactIds: [contact.id],
      subject: 'Hi',
      body: 'Hello',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' })
      })
    ).rejects.toThrow('Maya Patel is marked do not email.');
    expect(send).not.toHaveBeenCalled();
    expect(repo.listContactCommunications(contact.id)).toHaveLength(0);
  });

  test('sends direct email and records one communication per recipient', async () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const jo = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    const send = vi.fn(async () => 'smtp-accepted');

    const result = await sendDirectEmail(repo, send, {
      contactIds: [maya.id, jo.id],
      subject: 'Hi {{firstName}}',
      body: 'Hello {{fullName}}.',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({
        contactIds: [maya.id, jo.id],
        subject: 'Hi {{firstName}}',
        body: 'Hello {{fullName}}.'
      })
    });

    expect(result.sent).toBe(2);
    expect(send).toHaveBeenNthCalledWith(1, 'maya@example.com', 'Hi Maya', 'Hello Maya Patel.');
    expect(send).toHaveBeenNthCalledWith(2, 'jo@example.com', 'Hi Jo', 'Hello Jo Kim.');
    expect(repo.listContactCommunications(maya.id)[0]).toMatchObject({
      contactId: maya.id,
      source: 'direct',
      status: 'accepted',
      subject: 'Hi Maya',
      body: 'Hello Maya Patel.',
      providerMessage: 'smtp-accepted'
    });
    expect(repo.listContactCommunications(jo.id)[0]).toMatchObject({
      contactId: jo.id,
      source: 'direct',
      status: 'accepted',
      subject: 'Hi Jo',
      body: 'Hello Jo Kim.'
    });
  });

  test('records test-mode direct email attempts in contact history', async () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn(async () => ({
      providerMessage: 'smtp-accepted',
      finalText: 'Hello Maya Patel.\n\nAlex',
      testMode: true,
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      messageId: '<direct-1@example.com>'
    }));

    await sendDirectEmail(repo, send, {
      contactIds: [maya.id],
      subject: 'Hi {{firstName}}',
      body: 'Hello {{fullName}}.',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({
        contactIds: [maya.id],
        subject: 'Hi {{firstName}}',
        body: 'Hello {{fullName}}.'
      })
    });

    expect(repo.listContactCommunications(maya.id)[0]).toMatchObject({
      contactId: maya.id,
      source: 'direct',
      status: 'accepted',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      testMode: true,
      subject: 'Hi Maya',
      body: 'Hello Maya Patel.\n\nAlex',
      messageId: '<direct-1@example.com>',
      providerMessage: 'smtp-accepted'
    });
  });

  test('records attempted recipient fields when direct email delivery fails', async () => {
    const repo = createTestRepository();
    const maya = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn(async () => {
      throw new Error('SMTP rejected');
    });

    const result = await sendDirectEmail(repo, send, {
      contactIds: [maya.id],
      subject: 'Hi {{firstName}}',
      body: 'Hello {{fullName}}.',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({
        contactIds: [maya.id],
        subject: 'Hi {{firstName}}',
        body: 'Hello {{fullName}}.'
      })
    });

    expect(result.failed).toBe(1);
    expect(repo.listContactCommunications(maya.id)[0]).toMatchObject({
      contactId: maya.id,
      source: 'direct',
      status: 'failed',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'maya@example.com',
      testMode: false,
      subject: 'Hi Maya',
      body: 'Hello Maya Patel.',
      errorMessage: 'SMTP rejected'
    });
  });

  test('requires preview of the exact direct email before sending', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn();

    await expect(
      sendDirectEmail(repo, send, {
        contactIds: [contact.id],
        subject: 'Changed',
        body: 'Hello',
        instructorName: 'Alex',
        previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Original', body: 'Hello' })
      })
    ).rejects.toThrow('Preview this exact email before sending.');
    expect(send).not.toHaveBeenCalled();
  });

  test('rejects old unsigned direct preview payloads', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn();

    await expect(
      sendDirectEmail(repo, send, {
        contactIds: [contact.id],
        subject: 'Hi',
        body: 'Hello',
        instructorName: 'Alex',
        previewToken: JSON.stringify({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' })
      })
    ).rejects.toThrow('Preview this exact email before sending.');
    expect(send).not.toHaveBeenCalled();
  });

  test('blocks direct sends with missing variables', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn();

    await expect(
      sendDirectEmail(repo, send, {
        contactIds: [contact.id],
        subject: 'Class {{courseName}}',
        body: 'Hello',
        instructorName: 'Alex',
        previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Class {{courseName}}', body: 'Hello' })
      })
    ).rejects.toThrow('Resolve missing template variables before sending.');
    expect(send).not.toHaveBeenCalled();
  });
});
