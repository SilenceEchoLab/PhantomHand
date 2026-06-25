#!/usr/bin/env node
import { BrowserMcpServer } from "./server.js";

const server = new BrowserMcpServer();
server.run().catch(console.error);
