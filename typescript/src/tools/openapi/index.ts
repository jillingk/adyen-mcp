import {JsonObject, McpToolDefinition} from "openapi-mcp-generator/dist/types";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    type Tool,
    type CallToolResult,
    type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { getToolsFromOpenApi } from 'openapi-mcp-generator';

import axios, {type AxiosError, AxiosRequestConfig} from "axios";
import { z, ZodError } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import {Environment} from "../../configurations/configurations";

type SpecConfig = [
    specName: string,
    testUrl: string,
    liveUrl: string,
    usesLivePrefix: boolean
];

const SUPPORTED_API_CONFIGS: SpecConfig[] = [
    [
        'ManagementService-v3.json',
        'https://management-test.adyen.com/v3',
        'https://management-live.adyen.com/v3',
        false
    ],
    [
        'CheckoutService-v71.json',
        'https://checkout-test.adyen.com/v71',
        'https://{PREFIX}-checkout-live.adyenpayments.com/checkout/v71',
        true
    ],
];

interface RegisteredTool {
    definition: McpToolDefinition;
    baseUrl: string;
    options: AdyenOptions;
}

type ToolRegistry = Map<string, RegisteredTool>;

export async function createFromOpenApi(server: Server, options: AdyenOptions): Promise<void> {
    // TODO Map this to the options so user can decide which specs they want to use
    let toolRegistry: ToolRegistry = new Map<string, RegisteredTool>();

    // We extract the tool for every supported spec file and add this to a map of registered tools.
    for(const [specName, testUrl, liveUrl, usesLivePrefix] of SUPPORTED_API_CONFIGS) {
        let baseUrl: string;
        if(options.environment === Environment.LIVE) {
            baseUrl = usesLivePrefix ? liveUrl.replace("{PREFIX}", options.livePrefix) : liveUrl;
        } else {
            baseUrl = testUrl;
        }
        await registerToolsFromSpec(toolRegistry, options, `../specs/${specName}`, baseUrl)
    }
    await setTools(toolRegistry, server);
}

async function registerToolsFromSpec(
    registry: ToolRegistry,
    options: AdyenOptions,
    specFilePath: string,
    baseUrl: string
): Promise<void> {
    const toolDefinitionList: McpToolDefinition[] = await getToolsFromOpenApi(
        specFilePath,
        {
            filterFn: (tool) => tool.method.toLowerCase() === 'get',
        }
    );
    for (const definition of toolDefinitionList) {
        registry.set(definition.name, {
            definition,
            baseUrl,
            options
        });
    }
}

async function setTools(toolRegistry: ToolRegistry, server: Server): Promise<void> {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const toolsForClient: Tool[] = Array.from(toolRegistry.values()).map(regTool => ({
            name: regTool.definition.name,
            description: regTool.definition.description,
            inputSchema: regTool.definition.inputSchema as any // TODO check the input schema type
        }));

        return { tools: toolsForClient };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
        const { name: toolName, arguments: toolArgs } = request.params;
        const registeredTool = toolRegistry.get(toolName);

        if (!registeredTool) {
            console.error(`Error: Unknown tool requested: ${toolName}`);
            return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
        }

        return await executeApiTool(
            toolName,
            registeredTool.definition,
            toolArgs ?? {},
            registeredTool.options,
            registeredTool.baseUrl,
        );
    });
}

interface AdyenOptions {
    apiKey: string;
    environment: Environment;
    livePrefix: string;
}

async function executeApiTool(
    toolName: string,
    definition: McpToolDefinition,
    toolArgs: JsonObject,
    options: AdyenOptions,
    baseURL: string,
): Promise<CallToolResult> {
    try {
        // Validate arguments against the input schema
        let validatedArgs: JsonObject;
        try {
            const zodSchema = getZodSchemaFromJsonSchema(definition.inputSchema, toolName);
            const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
            validatedArgs = zodSchema.parse(argsToParse);
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.errors.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
                return { content: [{ type: 'text', text: validationErrorMessage }] };
            } else {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return { content: [{ type: 'text', text: `Internal error during validation setup: ${errorMessage}` }] };
            }
        }

        // Prepare URL, query parameters, headers, and request body
        let urlPath = definition.pathTemplate;
        const queryParams: Record<string, any> = {};
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        let requestBodyData: any = undefined;

        // Apply parameters to the URL path, query, or headers
        definition.executionParameters.forEach((param) => {
            const value = validatedArgs[param.name];
            if (typeof value !== 'undefined' && value !== null) {
                if (param.in === 'path') {
                    urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
                }
                else if (param.in === 'query') {
                    queryParams[param.name] = value;
                }
                else if (param.in === 'header') {
                    headers[param.name.toLowerCase()] = String(value);
                }
            }
        });

        // Ensure all path parameters are resolved
        if (urlPath.includes('{')) {
            throw new Error(`Failed to resolve path parameters: ${urlPath}`);
        }

        // TODO build correct base url - formatting test -> live, live url prefix and the exceptions (look at node library)
        const requestUrl = baseURL + urlPath;
        console.warn(`Created request url: ${requestUrl}`);

        // Handle request body if needed
        if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
            requestBodyData = validatedArgs['requestBody'];
            headers['content-type'] = definition.requestBodyContentType;
        }

        // Set API Key
        headers["x-api-key"] = options.apiKey;

        // Prepare the axios request configuration
        const config: AxiosRequestConfig = {
            method: definition.method.toUpperCase(),
            url: requestUrl,
            params: queryParams,
            headers: headers,
            ...(requestBodyData !== undefined && { data: requestBodyData }),
        };

        // Log request info to stderr (doesn't affect MCP output)
        console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);

        // Execute the request
        const response = await axios(config);

        // Process and format the response
        let responseText = '';
        const contentType = response.headers['content-type']?.toLowerCase() || '';

        // Handle JSON responses
        if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
            try {
                responseText = JSON.stringify(response.data, null, 2);
            } catch (e) {
                responseText = "[Stringify Error]";
            }
        }
        // Handle string responses
        else if (typeof response.data === 'string') {
            responseText = response.data;
        }
        // Handle other response types
        else if (response.data !== undefined && response.data !== null) {
            responseText = String(response.data);
        }
        // Handle empty responses
        else {
            responseText = `(Status: ${response.status} - No body content)`;
        }

        // Return formatted response
        return {
            content: [
                {
                    type: "text",
                    text: `API Response (Status: ${response.status}):\n${responseText}`
                }
            ],
        };

    } catch (error: unknown) {
        // Handle errors during execution
        let errorMessage: string;

        // Format Axios errors specially
        if (axios.isAxiosError(error)) {
            errorMessage = formatApiError(error);
        }
        // Handle standard errors
        else if (error instanceof Error) {
            errorMessage = error.message;
        }
        // Handle unexpected error types
        else {
            errorMessage = 'Unexpected error: ' + String(error);
        }

        // Log error to stderr
        console.error(`Error during execution of tool '${toolName}':`, errorMessage);

        // Return error message to client
        return { content: [{ type: "text", text: errorMessage }] };
    }
}

function formatApiError(error: AxiosError): string {
    let message = 'API request failed.';
    if (error.response) {
        message = `API Error: Status ${error.response.status} (${error.response.statusText || 'Status text not available'}). `;
        const responseData = error.response.data;
        const MAX_LEN = 200;
        if (typeof responseData === 'string') {
            message += `Response: ${responseData.substring(0, MAX_LEN)}${responseData.length > MAX_LEN ? '...' : ''}`;
        }
        else if (responseData) {
            try {
                const jsonString = JSON.stringify(responseData);
                message += `Response: ${jsonString.substring(0, MAX_LEN)}${jsonString.length > MAX_LEN ? '...' : ''}`;
            } catch {
                message += 'Response: [Could not serialize data]';
            }
        }
        else {
            message += 'No response body received.';
        }
    } else if (error.request) {
        message = 'API Network Error: No response received from server.';
        if (error.code) message += ` (Code: ${error.code})`;
    } else {
        message += `API Request Setup Error: ${error.message}`;
    }
    return message;
}

function getZodSchemaFromJsonSchema(jsonSchema: any, toolName: string): z.ZodTypeAny {
    if (typeof jsonSchema !== 'object' || jsonSchema === null) {
        return z.object({}).passthrough();
    }
    try {
        const zodSchemaString = jsonSchemaToZod(jsonSchema);
        const zodSchema = eval(zodSchemaString);
        if (typeof zodSchema?.parse !== 'function') {
            throw new Error('Eval did not produce a valid Zod schema.');
        }
        return zodSchema as z.ZodTypeAny;
    } catch (err: any) {
        console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
        return z.object({}).passthrough();
    }
}