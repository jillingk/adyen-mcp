import { createPaymentLinkTool, getPaymentLinkTool, updatePaymentLinkTool } from "./paymentLinks";
import { Tool } from "./types";
import {cancelPaymentTool, refundPaymentTool} from "./modifications";
import {createPaymentSessionTool, getPaymentMethodsTool, getPaymentSessionTool} from "./payments";
import {getMerchantAccountsTool, listMerchantAccountsTool} from "./management";
import { terminalTools } from "./terminals";
import {
    listAllCompanyWebhooksTool,
    listAllMerchantWebhooksTool,
    retrieveCompanyWebhookTool,
    retrieveMerchantWebhookTool
} from "./webhooks";

export const tools: Tool[] = [
  createPaymentLinkTool,
  getPaymentLinkTool,
  refundPaymentTool,
  createPaymentSessionTool,
  updatePaymentLinkTool,
  getPaymentSessionTool,
  getPaymentMethodsTool,
  listMerchantAccountsTool,
  getMerchantAccountsTool,
  cancelPaymentTool,
  ...terminalTools,
  listAllCompanyWebhooksTool,
  retrieveCompanyWebhookTool,
  listAllMerchantWebhooksTool,
  retrieveMerchantWebhookTool
];
