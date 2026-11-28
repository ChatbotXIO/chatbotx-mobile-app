import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { operations } from '@/api/generated/schema';
import { queryKeys } from '@/api/query-keys';

type ListResponse =
  operations['whatsappTemplates.list']['responses'][200]['content']['application/json'];
export type WhatsappTemplate = ListResponse[number];

type GetResponse =
  operations['whatsappTemplates.get']['responses'][200]['content']['application/json'];
export type WhatsappTemplateParameter = GetResponse['parameters'][number];

/** Parameter kinds the sheet can collect as a plain text value. Templates needing anything else
 * (media URLs are fine; catalog products / expiry timestamps are not) are shown but not sendable. */
const SUPPORTED_KINDS = new Set<WhatsappTemplateParameter['kind']>([
  'text',
  'image',
  'video',
  'document',
  'url_suffix',
  'coupon_code',
]);

export function isSendable(parameters: readonly WhatsappTemplateParameter[]): boolean {
  return parameters.every(
    (parameter) => !parameter.required || SUPPORTED_KINDS.has(parameter.kind),
  );
}

/** Approved templates on the WhatsApp number (`inboxId`) the conversation is on. */
export function useApprovedWhatsappTemplates(workspaceId: string, inboxId: string | undefined) {
  return useQuery({
    queryKey: ['ws', workspaceId, 'whatsapp-templates', 'list', inboxId] as const,
    enabled: inboxId !== undefined,
    queryFn: async (): Promise<WhatsappTemplate[]> => {
      const { data, error } = await apiClient.GET('/v1/whatsapp/templates', {
        params: { query: { inboxId, status: 'APPROVED' } },
      });
      if (error) throw new ApiError(error);
      return data;
    },
  });
}

export function useWhatsappTemplateDetail(workspaceId: string, templateId: string | null) {
  return useQuery({
    queryKey: ['ws', workspaceId, 'whatsapp-templates', 'detail', templateId] as const,
    enabled: templateId !== null,
    queryFn: async (): Promise<GetResponse> => {
      const { data, error } = await apiClient.GET('/v1/whatsapp/templates/{id}', {
        params: { path: { id: templateId ?? '' } },
      });
      if (error) throw new ApiError(error);
      return data;
    },
  });
}

interface SendTemplateInput {
  templateId: string;
  templateParams?: Record<string, string>;
  inboxId?: string;
}

/** Sends an approved template into the conversation, bypassing the 24h window. Delivery is
 * asynchronous, so the message list is refetched rather than patched. */
export function useSendWhatsappTemplate(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, templateParams, inboxId }: SendTemplateInput) => {
      const { error } = await apiClient.POST(
        '/v1/conversations/{conversationId}/whatsapp-template',
        {
          params: { path: { conversationId } },
          body: {
            templateId,
            ...(templateParams && Object.keys(templateParams).length > 0 ? { templateParams } : {}),
            ...(inboxId ? { inboxId } : {}),
          },
        },
      );
      if (error) throw new ApiError(error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ws.messages.list(workspaceId, conversationId),
      });
    },
  });
}
