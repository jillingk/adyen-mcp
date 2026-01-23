import {
  createPaymentLinkTool,
  getPaymentLinkTool,
  updatePaymentLinkTool,
} from './checkout/paymentLinks/index.js';
import {
  cancelPaymentTool,
  refundPaymentTool,
} from './checkout/modifications/index.js';
import {
  createPaymentSessionTool,
  getPaymentMethodsTool,
  getPaymentSessionTool,
} from './checkout/payments/index.js';
import {
  getMerchantAccountsTool,
  listMerchantAccountsTool,
} from './management/accounts/index.js';
import { terminalTools } from './management/terminals/index.js';
import { createHostedOnboardingLinkTool } from './legalEntityManagement/onboardingLinks/index.js';
import { getLegalEntityTool } from './legalEntityManagement/legalEntities/index.js';
import { getAccountHolderTool } from './configuration/accountHolders/index.js';
import {
  getCompanyWebhookTool,
  getMerchantWebhookTool,
  listAllCompanyWebhooksTool,
  listAllMerchantWebhooksTool,
} from './management/webhooks/index.js';
import { AdyenConfig } from '../configurations/configurations';
import { Tool } from './types';

export const toolGroups = {
  checkout: [
    createPaymentLinkTool,
    getPaymentLinkTool,
    updatePaymentLinkTool,
    refundPaymentTool,
    cancelPaymentTool,
    createPaymentSessionTool,
    getPaymentMethodsTool,
    getPaymentSessionTool,
  ],
  management: [
    listMerchantAccountsTool,
    getMerchantAccountsTool,
    ...terminalTools,
    listAllCompanyWebhooksTool,
    getCompanyWebhookTool,
    listAllMerchantWebhooksTool,
    getMerchantWebhookTool,
  ],
  legalEntityManagement: [createHostedOnboardingLinkTool, getLegalEntityTool],
  configuration: [getAccountHolderTool],
};

const tools = Object.values(toolGroups).flat();
type ToolCategory = keyof typeof toolGroups;
const formatList = (items: string[]) => items.map((i) => `'${i}'`).join(', ');

export function getActiveTools(adyenConfig: AdyenConfig): Set<Tool> {
  const hasApiFilter =
    adyenConfig.includeApi && adyenConfig.includeApi.length > 0;
  const hasToolFilter = adyenConfig.tools && adyenConfig.tools.length > 0;

  if (!hasApiFilter && !hasToolFilter) {
    return new Set<Tool>(tools);
  }

  const activeTools = new Set<Tool>();
  if (hasApiFilter) {
    adyenConfig.includeApi?.flatMap((apiName) => {
      const group = toolGroups[apiName as ToolCategory];
      if (!group) {
        console.error(
          `❌ Error: API Group '${apiName}' not found.\n` +
            `   👉 Available API groups: ${formatList(Object.keys(toolGroups))}`,
        );
      } else {
        group.forEach((i) => activeTools.add(i));
      }
    });
  }

  if (hasToolFilter) {
    adyenConfig.tools?.forEach((toolName) => {
      const tool = tools.find((t) => t.name === toolName);
      if (tool) {
        activeTools.add(tool);
      } else {
        console.error(
          `❌ Error: Tool '${toolName}' not found.\n` +
            `   👉 All available tools: ${formatList(tools.map((t) => t.name))}`,
        );
      }
    });
  }

  if (activeTools.size < 1) {
    throw new Error(
      '⛔ No valid tools were selected based on your configuration.\n' +
        '   Please check your --includeApi or --tools arguments.',
    );
  }
  return activeTools;
}
