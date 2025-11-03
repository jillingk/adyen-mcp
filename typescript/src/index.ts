#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@adyen/api-library";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tools } from "./tools/tools.js";
import { Environment, getAdyenConfig } from "./configurations/configurations";
import {createFromOpenApi} from "./tools/openapi";

const APPLICATION_NAME = "adyen-mcp-server";
const APP_NAME = "Adyen MCP";
const APP_VERSION = "0.3.0";

async function main() {
  const adyenConfig = getAdyenConfig();

  const options = {
    apiKey: adyenConfig.adyenApiKey,
    environment: adyenConfig.env as Environment,
    livePrefix: adyenConfig.livePrefix,
    generateFromOpenApi:  adyenConfig.generateFromOpenApi,
  };

  type ConnectableServer = McpServer | Server;
  let server: ConnectableServer;

  if(options.generateFromOpenApi) {
      console.warn("(Experimental) Trying to parse OpenAPI spec and generate in-memory MCP server..")
      server = new Server(
          { name: APP_NAME, version: APP_VERSION },
          { capabilities: { tools: {} } }
      );
      // Create Tool from OpenAPI spec and append to the MCP server
      await createFromOpenApi(server, options)

  } else {
       server = new McpServer(
          { name: APP_NAME, version: APP_VERSION },
      );

      // Build an Adyen Client
      const adyenClient = new Client(options);
      adyenClient.setApplicationName(APPLICATION_NAME + " " + APP_VERSION);

      if (options.environment === Environment.LIVE) {
          const livePrefix = adyenConfig.livePrefix;
          adyenClient.setEnvironment(options.environment, livePrefix);
      }

      for (const tool of tools) {
          server.tool(
              tool.name,
              tool.description,
              tool.arguments.shape,
              async (args: any, _extra: RequestHandlerExtra <any, any>) => {
                  const result = await tool.invoke(adyenClient, args);
                  return {
                      content: [
                          {
                              type: "text",
                              text: JSON.stringify(result),
                          },
                      ],
                  };
              }
          );
      }
  }
  console.warn("Starting server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start Adyen MCP Server
main().catch((error) => {
    console.error("An error occurred during main execution of Adyen MCP:", error);
    process.exit(1);
});

async function cleanup() {
    console.error("Shutting down Adyen MCP server...");
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);