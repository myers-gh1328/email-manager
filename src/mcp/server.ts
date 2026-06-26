import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { repo } from '../lib/server/app.js';
import { getAgentCapabilities, getAppOverview, getSchedulerReadiness } from '../lib/server/agent/orientation.js';
import { createContactTool, searchContactsTool, updateContactTool } from '../lib/server/agent/tools/contacts.js';
import {
  createClassSessionTool,
  enrollContactTool,
  getClassSessionTool,
  listClassSessionsTool,
  setEnrollmentChecklistCompletionTool,
  updateClassSessionTool
} from '../lib/server/agent/tools/classes.js';
import { createTemplateTool, listTemplatesTool, updateTemplateTool } from '../lib/server/agent/tools/templates.js';
import { commitSendDueCampaignsTool, prepareSendDueCampaignsTool } from '../lib/server/agent/tools/campaigns.js';
import { commitDirectEmailTool, prepareDirectEmailTool } from '../lib/server/agent/tools/communications.js';

function asToolContent(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value)
      }
    ]
  };
}

export function createMcpServer() {
  const server = new McpServer({
    name: 'training-communications-studio',
    version: '0.1.0'
  });

  server.registerTool(
    'get_app_overview',
    {
      title: 'Get App Overview',
      description: 'Return dashboard-style operational state without decrypted secrets or database paths.'
    },
    () => asToolContent(getAppOverview())
  );

  server.registerTool(
    'get_scheduler_readiness',
    {
      title: 'Get Scheduler Readiness',
      description: 'Return scheduled sending readiness, blockers, scheduled emails ready to send count, and next scheduled email ready to send.'
    },
    () => asToolContent(getSchedulerReadiness())
  );

  server.registerTool(
    'get_agent_capabilities',
    {
      title: 'Get Agent Capabilities',
      description: 'Return enabled agent permissions and unavailable operations.'
    },
    () => asToolContent(getAgentCapabilities())
  );

  server.registerTool(
    'search_contacts',
    {
      title: 'Search Contacts',
      description: 'Search contact records by name, email, phone, or notes.',
      inputSchema: {
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional()
      }
    },
    (input) => asToolContent(searchContactsTool(repo, input))
  );

  server.registerTool(
    'create_contact',
    {
      title: 'Create Contact',
      description: 'Create a reusable contact record.',
      inputSchema: contactInputSchema
    },
    (input) => asToolContent(createContactTool(repo, input))
  );

  server.registerTool(
    'update_contact',
    {
      title: 'Update Contact',
      description: 'Update an existing contact record.',
      inputSchema: {
        id: z.string(),
        ...contactInputSchema
      }
    },
    ({ id, ...input }) => asToolContent(updateContactTool(repo, id, input))
  );

  server.registerTool(
    'list_class_sessions',
    {
      title: 'List Class Sessions',
      description: 'List or search class sessions.',
      inputSchema: {
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional()
      }
    },
    (input) => asToolContent(listClassSessionsTool(repo, input))
  );

  server.registerTool(
    'get_class_session',
    {
      title: 'Get Class Session',
      description: 'Return one class session with roster and checklist state.',
      inputSchema: {
        classSessionId: z.string()
      }
    },
    ({ classSessionId }) => asToolContent(getClassSessionTool(repo, classSessionId))
  );

  server.registerTool(
    'create_class_session',
    {
      title: 'Create Class Session',
      description: 'Create a dated class session.',
      inputSchema: classSessionInputSchema
    },
    (input) => asToolContent(createClassSessionTool(repo, input))
  );

  server.registerTool(
    'update_class_session',
    {
      title: 'Update Class Session',
      description: 'Update an existing class session.',
      inputSchema: {
        id: z.string(),
        ...classSessionInputSchema
      }
    },
    ({ id, ...input }) => asToolContent(updateClassSessionTool(repo, id, input))
  );

  server.registerTool(
    'enroll_contact',
    {
      title: 'Enroll Contact',
      description: 'Enroll a contact in a class session.',
      inputSchema: {
        classSessionId: z.string(),
        contactId: z.string()
      }
    },
    (input) => asToolContent(enrollContactTool(repo, input))
  );

  server.registerTool(
    'set_enrollment_checklist_completion',
    {
      title: 'Set Enrollment Checklist Completion',
      description: 'Mark a class roster checklist item complete or incomplete for one contact.',
      inputSchema: {
        classSessionId: z.string(),
        contactId: z.string(),
        itemScope: z.enum(['global', 'course_type']),
        itemId: z.string(),
        completed: z.boolean()
      }
    },
    (input) => asToolContent(setEnrollmentChecklistCompletionTool(repo, input))
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List Templates',
      description: 'List or search reusable email templates.',
      inputSchema: {
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional()
      }
    },
    (input) => asToolContent(listTemplatesTool(repo, input))
  );

  server.registerTool(
    'create_template',
    {
      title: 'Create Template',
      description: 'Create a reusable email template.',
      inputSchema: templateInputSchema
    },
    (input) => asToolContent(createTemplateTool(repo, input))
  );

  server.registerTool(
    'update_template',
    {
      title: 'Update Template',
      description: 'Update an existing email template.',
      inputSchema: {
        id: z.string(),
        ...templateInputSchema
      }
    },
    ({ id, ...input }) => asToolContent(updateTemplateTool(repo, id, input))
  );

  server.registerTool(
    'prepare_direct_email',
    {
      title: 'Prepare Direct Email',
      description: 'Preview and create an approval packet for a direct email send.',
      inputSchema: directEmailInputSchema
    },
    (input) => asToolContent(prepareDirectEmailTool(repo, input))
  );

  server.registerTool(
    'commit_direct_email',
    {
      title: 'Commit Direct Email',
      description: 'Send a prepared direct email after exact human approval confirmation.',
      inputSchema: approvalCommitInputSchema
    },
    async (input) => asToolContent(await commitDirectEmailTool(repo, input))
  );

  server.registerTool(
    'prepare_send_due_campaigns',
    {
      title: 'Prepare Send Due Campaigns',
      description: 'Create an approval packet for currently due scheduled emails.',
      inputSchema: {}
    },
    () => asToolContent(prepareSendDueCampaignsTool(repo))
  );

  server.registerTool(
    'commit_send_due_campaigns',
    {
      title: 'Commit Send Due Campaigns',
      description: 'Run the shared send-due scheduled-email path after exact human approval confirmation.',
      inputSchema: approvalCommitInputSchema
    },
    async (input) => asToolContent(await commitSendDueCampaignsTool(repo, input))
  );

  return server;
}

const contactInputSchema = {
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  doNotEmail: z.boolean().optional()
};

const classSessionInputSchema = {
  courseTypeId: z.string(),
  locationId: z.string().optional(),
  startsOn: z.string(),
  endsOn: z.string().optional(),
  startTime: z.string().optional(),
  location: z.string(),
  notes: z.string().optional()
};

const templateInputSchema = {
  name: z.string(),
  subject: z.string(),
  body: z.string()
};

const directEmailInputSchema = {
  contactIds: z.array(z.string()).min(1),
  subject: z.string(),
  body: z.string(),
  instructorName: z.string()
};

const approvalCommitInputSchema = {
  approvalId: z.string(),
  confirmationText: z.string()
};
