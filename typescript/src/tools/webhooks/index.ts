import { z } from "zod";
import { Client, ManagementAPI } from "@adyen/api-library";
import { Tool } from "../types";
import {
    LIST_ALL_COMPANY_WEBHOOKS,
    LIST_ALL_COMPANY_WEBHOOKS_DESCRIPTION,
    LIST_ALL_MERCHANT_WEBHOOKS,
    LIST_ALL_MERCHANT_WEBHOOKS_DESCRIPTION,
    RETRIEVE_COMPANY_WEBHOOK,
    RETRIEVE_COMPANY_WEBHOOK_DESCRIPTION,
    RETRIEVE_MERCHANT_WEBHOOK,
    RETRIEVE_MERCHANT_WEBHOOK_DESCRIPTION
} from "./constants";

const listAllMerchantWebhooksRequestObject = z.object(
    {
        merchantId: z.string(),
        pageSize: z.number(),
        pageNumber: z.number(),
    }
);

const listAllMerchantWebhooks = async (
    client: Client,
    req: z.infer<
        typeof listAllMerchantWebhooksRequestObject
    >,
) => {
    const { merchantId, pageSize, pageNumber } = req;

    const managementAPI = new ManagementAPI(client);
    try {
        return await managementAPI.WebhooksMerchantLevelApi.listAllWebhooks(
            merchantId, pageNumber, pageSize
        );
    } catch (e) {
        return "Failed to list all webhook configurations on merchant account. Error: " + JSON.stringify(e);
    }
};

export const listAllMerchantWebhooksTool: Tool = {
    name: LIST_ALL_MERCHANT_WEBHOOKS,
    description: LIST_ALL_MERCHANT_WEBHOOKS_DESCRIPTION,
    arguments: listAllMerchantWebhooksRequestObject,
    invoke: listAllMerchantWebhooks,
};

const retrieveMerchantWebhookShape: z.ZodRawShape = {
    merchantId: z.string(),
    webhookId: z.string(),
};

const retrieveMerchantWebhookRequestObject = z.object(
    retrieveMerchantWebhookShape,
);

const retrieveMerchantWebhook = async (
    client: Client,
    req: z.infer<
        typeof retrieveMerchantWebhookRequestObject
    >,
) => {
    const { merchantId, webhookId } = req;

    const managementAPI = new ManagementAPI(client);
    try {
        return await managementAPI.WebhooksMerchantLevelApi.getWebhook(
            merchantId, webhookId
        );
    } catch (e) {
        return "Failed to retrieve merchant webhook configuration. Error: " + JSON.stringify(e);
    }
};

export const retrieveMerchantWebhookTool: Tool = {
    name: RETRIEVE_MERCHANT_WEBHOOK,
    description: RETRIEVE_MERCHANT_WEBHOOK_DESCRIPTION,
    arguments: retrieveMerchantWebhookRequestObject,
    invoke: retrieveMerchantWebhook,
};

const listAllCompanyWebhooksRequestObject = z.object(
    {
        companyId: z.string(),
        pageSize: z.number(),
        pageNumber: z.number(),
    }
);

const listAllCompanyWebhooks = async (
    client: Client,
    req: z.infer<
        typeof listAllCompanyWebhooksRequestObject
    >,
) => {
    const { companyId, pageSize, pageNumber } = req;

    const managementAPI = new ManagementAPI(client);
    try {
        return await managementAPI.WebhooksCompanyLevelApi.listAllWebhooks(
            companyId, pageNumber, pageSize
        );
    } catch (e) {
        return "Failed to list all webhook configurations on company account. Error: " + JSON.stringify(e);
    }
};

export const listAllCompanyWebhooksTool: Tool = {
    name: LIST_ALL_COMPANY_WEBHOOKS,
    description: LIST_ALL_COMPANY_WEBHOOKS_DESCRIPTION,
    arguments: listAllCompanyWebhooksRequestObject,
    invoke: listAllCompanyWebhooks,
};

const retrieveCompanyWebhookRequestObject = z.object(
    {
        companyId: z.string(),
        webhookId: z.string(),
    }
);

const retrieveCompanyWebhook = async (
    client: Client,
    req: z.infer<
        typeof retrieveCompanyWebhookRequestObject
    >,
) => {
    const { companyId, webhookId } = req;

    const managementAPI = new ManagementAPI(client);
    try {
        return await managementAPI.WebhooksCompanyLevelApi.getWebhook(
            companyId, webhookId
        );
    } catch (e) {
        return "Failed to retrieve company webhook configuration. Error: " + JSON.stringify(e);
    }
};

export const retrieveCompanyWebhookTool: Tool = {
    name: RETRIEVE_COMPANY_WEBHOOK,
    description: RETRIEVE_COMPANY_WEBHOOK_DESCRIPTION,
    arguments: retrieveCompanyWebhookRequestObject,
    invoke: retrieveCompanyWebhook,
};