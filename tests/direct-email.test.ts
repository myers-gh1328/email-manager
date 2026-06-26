import { describe, expect, test, vi } from 'vitest';
import { createTestRepository } from './repository-helpers';
import { directEmailOperationId, directEmailPreviewToken, previewDirectEmail, sendDirectEmail } from '../src/lib/server/direct-email';
import { baseAppSettings } from './settings-helpers';

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
    const sourceId = directEmailOperationId({
      contactIds: [maya.id, jo.id],
      subject: 'Hi {{firstName}}',
      body: 'Hello {{fullName}}.',
      previewToken: directEmailPreviewToken({
        contactIds: [maya.id, jo.id],
        subject: 'Hi {{firstName}}',
        body: 'Hello {{fullName}}.'
      })
    });
    expect(send).toHaveBeenNthCalledWith(1, 'maya@example.com', 'Hi Maya', 'Hello Maya Patel.');
    expect(send).toHaveBeenNthCalledWith(2, 'jo@example.com', 'Hi Jo', 'Hello Jo Kim.');
    expect(repo.listContactCommunications(maya.id)[0]).toMatchObject({
      contactId: maya.id,
      source: 'direct',
      sourceId,
      status: 'accepted',
      subject: 'Hi Maya',
      body: 'Hello Maya Patel.',
      providerMessage: 'smtp-accepted'
    });
    expect(repo.listContactCommunications(jo.id)[0]).toMatchObject({
      contactId: jo.id,
      source: 'direct',
      sourceId,
      status: 'accepted',
      subject: 'Hi Jo',
      body: 'Hello Jo Kim.'
    });
    expect(repo.listCommunicationsPage({ sourceId }).total).toBe(2);
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

  test('does not record a failed send when accepted direct-email history recording fails', async () => {
    const backingRepo = createTestRepository();
    const maya = backingRepo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const repo = {
      getContact: backingRepo.getContact.bind(backingRepo),
      recordCommunication: vi.fn(() => {
        throw new Error('history unavailable');
      })
    };
    const send = vi.fn(async () => 'smtp-accepted');

    await expect(
      sendDirectEmail(repo, send, {
        contactIds: [maya.id],
        subject: 'Hi {{firstName}}',
        body: 'Hello {{fullName}}.',
        instructorName: 'Alex',
        previewToken: directEmailPreviewToken({
          contactIds: [maya.id],
          subject: 'Hi {{firstName}}',
          body: 'Hello {{fullName}}.'
        })
      })
    ).rejects.toThrow('history unavailable');

    expect(send).toHaveBeenCalledOnce();
    expect(repo.recordCommunication).toHaveBeenCalledTimes(1);
    expect(repo.recordCommunication).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
    expect(repo.recordCommunication).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
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

  test('returns existing direct send operation result without resending duplicate commits', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn(async () => 'smtp-accepted');
    const input = {
      contactIds: [contact.id],
      subject: 'Hi',
      body: 'Hello',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' }),
      settings: baseAppSettings({ outboundMaxPerMinute: 10, outboundMaxPerHour: 50 })
    };

    const first = await sendDirectEmail(repo, send, input);
    const second = await sendDirectEmail(repo, send, input);

    expect(first).toMatchObject({ sent: 1, failed: 0 });
    expect(second).toMatchObject({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('expired direct send operation requires attention instead of resending', async () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const send = vi.fn();
    const input = {
      contactIds: [contact.id],
      subject: 'Hi',
      body: 'Hello',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' }),
      settings: baseAppSettings()
    };
    const sendOperationId = directEmailOperationId(input);
    repo.beginSendOperation({
      operationType: 'direct_email',
      sendOperationId,
      idempotencyKey: sendOperationId,
      requestHash: sendOperationId,
      recipients: [{ contactId: contact.id, email: contact.email }]
    });
    const db = (repo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
    db.prepare("update send_operations set expires_at = '2000-01-01T00:00:00.000Z' where status = 'sending'").run();

    await expect(sendDirectEmail(repo, send, input)).rejects.toThrow(
      'This send was interrupted before it finished. It needs attention before sending again.'
    );
    await expect(sendDirectEmail(repo, send, input)).rejects.not.toThrow('Review');
    expect(send).not.toHaveBeenCalled();
  });

  test('needs-attention direct send operation uses plain retry-blocked wording', async () => {
    const backingRepo = createTestRepository();
    const contact = backingRepo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const input = {
      contactIds: [contact.id],
      subject: 'Hi',
      body: 'Hello',
      instructorName: 'Alex',
      previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' }),
      settings: baseAppSettings()
    };
    const repo = {
      getContact: backingRepo.getContact.bind(backingRepo),
      recordCommunication: backingRepo.recordCommunication.bind(backingRepo),
      getSendOperation: vi.fn(() => ({ id: 'operation-1', status: 'needs_attention', resultSummary: '', failureSummary: '' }))
    };
    const send = vi.fn();

    await expect(sendDirectEmail(repo, send, input)).rejects.toThrow('This send needs attention before sending again.');
    await expect(sendDirectEmail(repo, send, input)).rejects.not.toThrow('review');
    expect(send).not.toHaveBeenCalled();
  });

  test('direct send operation claim expires after fifteen minutes', () => {
    const repo = createTestRepository();
    const contact = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const before = Date.now();
    const sendOperationId = directEmailOperationId({
      contactIds: [contact.id],
      subject: 'Hi',
      body: 'Hello',
      previewToken: directEmailPreviewToken({ contactIds: [contact.id], subject: 'Hi', body: 'Hello' })
    });

    repo.beginSendOperation({
      operationType: 'direct_email',
      sendOperationId,
      idempotencyKey: sendOperationId,
      requestHash: sendOperationId,
      recipients: [{ contactId: contact.id, email: contact.email }]
    });

    const db = (repo as unknown as { db: { prepare: (sql: string) => { get: (...args: unknown[]) => { expires_at: string } } } }).db;
    const row = db.prepare('select expires_at from send_operations where send_operation_id = ?').get(sendOperationId);
    const expiresInMs = new Date(row.expires_at).getTime() - before;

    expect(expiresInMs).toBeGreaterThan(14 * 60_000);
    expect(expiresInMs).toBeLessThanOrEqual(15 * 60_000 + 1000);
  });

  test('enforces direct email recipient cap before sending', async () => {
    const repo = createTestRepository();
    const first = repo.createContact({ firstName: 'Maya', lastName: 'Patel', email: 'maya@example.com' });
    const second = repo.createContact({ firstName: 'Jo', lastName: 'Kim', email: 'jo@example.com' });
    const send = vi.fn();

    await expect(
      sendDirectEmail(repo, send, {
        contactIds: [first.id, second.id],
        subject: 'Hi',
        body: 'Hello',
        instructorName: 'Alex',
        previewToken: directEmailPreviewToken({ contactIds: [first.id, second.id], subject: 'Hi', body: 'Hello' }),
        settings: baseAppSettings({ outboundDirectMaxRecipients: 1 })
      })
    ).rejects.toThrow('Send to 1 or fewer recipients at a time.');
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
