"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/SidebarProvider.ts
var vscode = __toESM(require("vscode"));
var SidebarProvider = class {
  constructor(_extensionUri) {
    this._extensionUri = _extensionUri;
  }
  static viewType = "devalley-sidebar-view";
  _view;
  _messageHandler;
  _authToken = null;
  _userInfo = null;
  // Authentication methods
  getAuthToken() {
    return this._authToken;
  }
  getUserInfo() {
    return this._userInfo;
  }
  isAuthenticated() {
    return !!this._authToken;
  }
  updateAuthToken(token) {
    this._authToken = token;
  }
  clearAuth() {
    this._authToken = null;
    this._userInfo = null;
  }
  setMessageHandler(handler) {
    this._messageHandler = handler;
  }
  sendResponse(text) {
    this._view?.webview.postMessage({ type: "assistant", text });
  }
  sendError(text) {
    this._view?.webview.postMessage({ type: "error", text });
  }
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "login": {
          await this.handleLogin(msg);
          break;
        }
        case "send": {
          if (!this.isAuthenticated()) {
            this.sendError("Authentication required. Please login first.");
            this._view?.webview.postMessage({ type: "showLogin" });
            return;
          }
          if (this._messageHandler) {
            await this._messageHandler(msg.text);
          }
          break;
        }
        case "copy": {
          try {
            await vscode.env.clipboard.writeText(msg.text);
            vscode.window.showInformationMessage("Code copied!");
          } catch (error) {
            vscode.window.showErrorMessage("Copy failed");
          }
          break;
        }
        case "insert": {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            try {
              await editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, msg.text);
              });
              vscode.window.showInformationMessage("Code inserted!");
            } catch (error) {
              vscode.window.showErrorMessage("Insert failed");
            }
          } else {
            vscode.window.showWarningMessage("No active editor");
          }
          break;
        }
        case "logout": {
          this.clearAuth();
          this._view?.webview.postMessage({ type: "showLogin" });
          break;
        }
      }
    });
  }
  async handleLogin(msg) {
    const { username, password } = msg;
    if (!username || !password) {
      this._view?.webview.postMessage({
        type: "loginError",
        message: "Please enter both username and password"
      });
      return;
    }
    try {
      console.log("Attempting login for:", username);
      const response = await fetch("http://192.168.1.10:9090/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        console.log("Login successful for:", username);
        this._authToken = result.token || result.access_token || `user_${result.user_id}`;
        this._userInfo = {
          id: result.user_id,
          email: result.email,
          conversation_id: result.conversation_id
        };
        this._view?.webview.postMessage({
          type: "loginSuccess",
          user: this._userInfo
        });
      } else {
        console.log("Login failed:", result.message);
        this._view?.webview.postMessage({
          type: "loginError",
          message: result.message || "Invalid credentials"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      this._view?.webview.postMessage({
        type: "loginError",
        message: "Connection failed. Please check if auth server is running on port 9090."
      });
    }
  }
  _getHtml() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            margin: 0;
            padding: 0;
            background: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        /* Login Panel Styles */
        .login-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            background: var(--vscode-sideBar-background);
        }
        
        .login-panel {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 32px;
            width: 100%;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 24px;
        }
        
        .login-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }
        
        .login-subtitle {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }
        
        .form-group {
            margin-bottom: 16px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
            color: var(--vscode-editor-foreground);
        }
        
        .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
            transition: border-color 0.2s ease;
        }
        
        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .form-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        
        .login-button {
            width: 100%;
            padding: 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .login-button:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }
        
        .login-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .login-error {
            margin-top: 12px;
            padding: 8px 12px;
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
        }
        
        /* Chat Interface Styles */
        .chat-container {
            display: none;
            height: 100vh;
            flex-direction: column;
        }
        
        .chat-container.active {
            display: flex;
        }
        
        /* Header */
        .header {
            padding: 12px 16px;
            background: var(--vscode-sideBarTitle-background);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            flex-shrink: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h3 {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-sideBarTitle-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .logout-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .logout-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Messages Container */
        #messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background: var(--vscode-sideBar-background);
            scroll-behavior: smooth;
        }
        
        /* Custom Scrollbar */
        #messages::-webkit-scrollbar {
            width: 8px;
        }
        
        #messages::-webkit-scrollbar-track {
            background: var(--vscode-scrollbar-shadow);
        }
        
        #messages::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }
        
        #messages::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
        
        /* Message Container */
        .message-container {
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
            animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* User Message Bubble */
        .user-message {
            align-self: flex-end;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 10px 14px;
            border-radius: 18px 18px 4px 18px;
            max-width: 85%;
            min-width: fit-content;
            word-wrap: break-word;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            position: relative;
            font-size: 13px;
            line-height: 1.4;
        }
        
        .user-message::after {
            content: '';
            position: absolute;
            bottom: 0;
            right: -6px;
            width: 0;
            height: 0;
            border-left: 6px solid var(--vscode-button-background);
            border-bottom: 6px solid transparent;
        }
        
        /* Assistant Message */
        .assistant-message {
            align-self: flex-start;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-widget-border);
            padding: 12px 16px;
            border-radius: 18px 18px 18px 4px;
            max-width: 95%;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
        }
        
        .assistant-message::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: -7px;
            width: 0;
            height: 0;
            border-right: 7px solid var(--vscode-editor-background);
            border-bottom: 7px solid transparent;
        }
        
        .assistant-message::before {
            content: '';
            position: absolute;
            bottom: -1px;
            left: -8px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-widget-border);
            border-bottom: 8px solid transparent;
        }
        
        /* Code Block Styling */
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            margin: 12px 0;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .code-header {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
        }
        
        .code-language {
            color: var(--vscode-descriptionForeground);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .code-actions {
            display: flex;
            gap: 6px;
        }
        
        .code-action-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .code-action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }
        
        .code-content {
            padding: 16px;
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.4;
            white-space: pre-wrap;
            overflow-x: auto;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            max-height: 300px;
        }
        
        /* Inline Code */
        .inline-code {
            background: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.9em;
            border: 1px solid var(--vscode-widget-border);
        }
        
        /* Typography */
        .assistant-message h1 {
            font-size: 16px;
            font-weight: 700;
            margin: 16px 0 10px 0;
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-charts-blue);
            padding-bottom: 4px;
        }

        .assistant-message h2 {
            font-size: 15px;
            font-weight: 600;
            margin: 14px 0 8px 0;
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 2px;
        }

        .assistant-message h3 {
            font-size: 14px;
            font-weight: 600;
            margin: 12px 0 6px 0;
            color: var(--vscode-editor-foreground);
        }

        .assistant-message ul, .assistant-message ol {
            margin: 10px 0;
            padding-left: 20px;
            line-height: 1.6;
        }

        .assistant-message li {
            margin: 4px 0;
            color: var(--vscode-editor-foreground);
        }

        .assistant-message blockquote {
            margin: 10px 0;
            padding: 10px 14px;
            border-left: 4px solid var(--vscode-charts-blue);
            background: var(--vscode-textBlockQuote-background);
            color: var(--vscode-textBlockQuote-foreground);
            font-style: italic;
            border-radius: 0 4px 4px 0;
        }

        .assistant-message hr {
            margin: 16px 0;
            border: none;
            height: 1px;
            background: var(--vscode-widget-border);
        }

        .assistant-message p {
            margin: 6px 0;
            line-height: 1.5;
            color: var(--vscode-editor-foreground);
        }

        .assistant-message strong {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }

        .assistant-message em {
            font-style: italic;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Input Area */
        #inputForm {
            flex-shrink: 0;
            padding: 12px 16px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }
        
        #messageInput {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 20px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            resize: none;
            outline: none;
            transition: border-color 0.2s ease;
            min-height: 36px;
        }
        
        #messageInput:focus {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        #messageInput::placeholder {
            color: var(--vscode-input-placeholderForeground);
            opacity: 0.7;
        }
        
        #sendButton {
            padding: 10px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 18px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
        }
        
        #sendButton:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }
        
        #sendButton:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        /* Welcome Message */
        .welcome-message {
            text-align: center;
            padding: 32px 20px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .welcome-message .icon {
            font-size: 24px;
            margin-bottom: 8px;
            opacity: 0.8;
        }
        
        /* Status Indicators */
        .status-online {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-charts-green);
            animation: pulse 2s infinite;
            margin-right: 6px;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <!-- Login Panel -->
    <div id="loginContainer" class="login-container">
        <div class="login-panel">
            <div class="login-header">
                <div class="login-title">\u{1F916} DevAlley</div>
                <div class="login-subtitle">Sign in to your coding assistant</div>
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label class="form-label" for="username">Email</label>
                    <input type="email" id="username" class="form-input" placeholder="Enter your email" autocomplete="email" />
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <input type="password" id="password" class="form-input" placeholder="Enter your password" autocomplete="current-password" />
                </div>
                
                <button type="submit" class="login-button" id="loginButton">Sign In</button>
                
                <div id="loginError" class="login-error" style="display: none;"></div>
            </form>
        </div>
    </div>
    
    <!-- Chat Interface -->
    <div id="chatContainer" class="chat-container">
        <div class="header">
            <h3><span class="status-online"></span>DevAlley Assistant</h3>
            <button class="logout-btn" id="logoutBtn">Logout</button>
        </div>
        
        <div id="messages">
            <div class="welcome-message">
                <div>Welcome to DevAlley! Your AI coding assistant is ready to help.</div>
            </div>
        </div>
        
        <form id="inputForm">
            <input id="messageInput" type="text" placeholder="Ask DevAlley anything..." autocomplete="off" />
            <button type="submit" id="sendButton">Send</button>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const loginContainer = document.getElementById('loginContainer');
        const chatContainer = document.getElementById('chatContainer');
        const loginForm = document.getElementById('loginForm');
        const loginButton = document.getElementById('loginButton');
        const loginError = document.getElementById('loginError');
        const logoutBtn = document.getElementById('logoutBtn');
        
        const form = document.getElementById('inputForm');
        const input = document.getElementById('messageInput');
        const messages = document.getElementById('messages');
        const sendButton = document.getElementById('sendButton');

        // Enhanced HTML entity escaping
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Format response with markdown and code blocks
        function formatResponse(text) {
            let formatted = text;
            
            const codeBlockRegex = /\`\`\`([\\w]*)[\\s]*([\\s\\S]*?)\`\`\`/g;
            const codeBlocks = [];
            let match;
            let index = 0;
            
            while ((match = codeBlockRegex.exec(text)) !== null) {
                const placeholder = '__CODE_BLOCK_' + index + '__';
                const language = match[1] || 'text';
                const code = match[2].trim();
                
                codeBlocks.push({
                    placeholder: placeholder,
                    language: language,
                    code: code,
                    id: 'code_' + Date.now() + '_' + index
                });
                
                formatted = formatted.replace(match[0], placeholder);
                index++;
            }
            
            // Handle inline code
            const inlineCodeRegex = /\`([^\`\\n]+)\`/g;
            const inlineCodes = [];
            let inlineIndex = 0;
            
            while ((match = inlineCodeRegex.exec(formatted)) !== null) {
                const placeholder = '__INLINE_CODE_' + inlineIndex + '__';
                inlineCodes.push({
                    placeholder: placeholder,
                    code: match[1]
                });
                formatted = formatted.replace(match[0], placeholder);
                inlineIndex++;
            }
            
            // Process markdown
            formatted = formatted.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            formatted = formatted.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            formatted = formatted.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            formatted = formatted.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
            formatted = formatted.replace(/^[\\s]*[-*+] (.*)$/gm, '<li>$1</li>');
            formatted = formatted.replace(/(<li>.*<\\/li>(\\s*<li>.*<\\/li>)*)/gs, '<ul>$1</ul>');
            formatted = formatted.replace(/^[\\s]*\\d+\\. (.*)$/gm, '<li>$1</li>');
            formatted = formatted.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
            formatted = formatted.replace(/^[-*]{3,}$/gm, '<hr>');
            formatted = formatted.replace(/\\n\\n/g, '</p><p>');
            formatted = '<p>' + formatted + '</p>';
            formatted = formatted.replace(/\\n/g, '<br>');
            formatted = formatted.replace(/<p><\\/p>/g, '');
            formatted = formatted.replace(/<p>[\\s]*<\\/p>/g, '');
            
            // Restore inline code
            inlineCodes.forEach(function(inlineCode) {
                const escapedCode = escapeHtml(inlineCode.code);
                formatted = formatted.replace(inlineCode.placeholder, '<span class="inline-code">' + escapedCode + '</span>');
            });
            
            // Replace code blocks
            codeBlocks.forEach(function(block) {
                const codeHtml = '<div class="code-block">' +
                    '<div class="code-header">' +
                        '<span class="code-language">' + block.language.toUpperCase() + '</span>' +
                        '<div class="code-actions">' +
                            '<button class="code-action-btn" onclick="copyCode(\\''+block.id+'\\')" title="Copy code">\u{1F4CB} Copy</button>' +
                            '<button class="code-action-btn" onclick="insertCode(\\''+block.id+'\\')" title="Insert">\u2795 Insert</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="code-content" id="' + block.id + '">' + escapeHtml(block.code) + '</div>' +
                '</div>';
                
                formatted = formatted.replace(block.placeholder, codeHtml);
            });
            
            return formatted;
        }

        // Global functions for code actions
        window.copyCode = function(id) {
            const element = document.getElementById(id);
            if (element) {
                vscode.postMessage({ type: 'copy', text: element.textContent });
            }
        };

        window.insertCode = function(id) {
            const element = document.getElementById(id);
            if (element) {
                vscode.postMessage({ type: 'insert', text: element.textContent });
            }
        };

        // Login form handling
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (!username || !password) {
                showLoginError('Please enter both email and password');
                return;
            }
            
            loginButton.disabled = true;
            loginButton.textContent = 'Signing in...';
            hideLoginError();
            
            vscode.postMessage({ 
                type: 'login', 
                username: username, 
                password: password 
            });
        });

        // Logout handling
        logoutBtn.addEventListener('click', function() {
            vscode.postMessage({ type: 'logout' });
            showLogin();
        });

        function showLogin() {
            loginContainer.style.display = 'flex';
            chatContainer.classList.remove('active');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In';
            hideLoginError();
            document.getElementById('username').focus();
        }

        function showChat() {
            loginContainer.style.display = 'none';
            chatContainer.classList.add('active');
            input.focus();
        }

        function showLoginError(message) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }

        function hideLoginError() {
            loginError.style.display = 'none';
        }

        function addMessage(role, text) {
            const welcome = messages.querySelector('.welcome-message');
            if (welcome && role === 'user') {
                welcome.remove();
            }

            const container = document.createElement('div');
            container.className = 'message-container';
            
            const message = document.createElement('div');
            message.className = role === 'user' ? 'user-message' : 'assistant-message';
            
            if (role === 'user') {
                message.textContent = text;
            } else {
                message.innerHTML = formatResponse(text);
            }
            
            container.appendChild(message);
            messages.appendChild(container);
            messages.scrollTop = messages.scrollHeight;
        }

        // Chat form handling
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            
            addMessage('user', text);
            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';
            
            vscode.postMessage({ type: 'send', text: text });
            input.value = '';
        });

        // Handle messages from extension
        window.addEventListener('message', function(e) {
            const msg = e.data;
            
            if (msg.type === 'loginSuccess') {
                showChat();
            } else if (msg.type === 'loginError') {
                showLoginError(msg.message);
                loginButton.disabled = false;
                loginButton.textContent = 'Sign In';
            } else if (msg.type === 'showLogin') {
                showLogin();
            } else if (msg.type === 'assistant') {
                addMessage('assistant', msg.text);
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
                input.focus();
            } else if (msg.type === 'error') {
                addMessage('assistant', 'Error: ' + msg.text);
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
                input.focus();
            }
        });

        // Initialize - show login panel
        showLogin();
    </script>
</body>
</html>`;
  }
};

// src/extension.ts
function activate(context) {
  console.log("DevAlley extension STARTING activation...");
  try {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    console.log("SidebarProvider created successfully");
    context.subscriptions.push(
      vscode2.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider
      )
    );
    const completionProvider = vscode2.languages.registerCompletionItemProvider(
      { pattern: "**" },
      // All files
      {
        provideCompletionItems(document, position, token, context2) {
          return provideCompletions(document, position, token, context2);
        }
      },
      ".",
      "(",
      '"',
      "'",
      " ",
      "\n"
    );
    const inlineCompletionProvider = vscode2.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      {
        provideInlineCompletionItems: async (document, position, context2, token) => {
          const config = vscode2.workspace.getConfiguration("devalley");
          if (!config.get("completions.enabled", true)) {
            return [];
          }
          try {
            const startLine = Math.max(0, position.line - 20);
            const textBeforeCursor = document.getText(
              new vscode2.Range(startLine, 0, position.line, position.character)
            );
            const currentLine = document.lineAt(position.line);
            const textAfterCursor = currentLine.text.substring(position.character);
            const prompt = `Complete this ${document.languageId} code:

Context:
${textBeforeCursor}|CURSOR|${textAfterCursor}

Provide a single completion that continues from the cursor position. Only return the completion text, nothing else.`;
            const response = await queryBackendForCompletion(prompt);
            if (response && response.trim()) {
              return [
                new vscode2.InlineCompletionItem(
                  response.trim(),
                  new vscode2.Range(position, position)
                )
              ];
            }
          } catch (error) {
            console.error("Inline completion error:", error);
          }
          return [];
        }
      }
    );
    const hoverProvider = vscode2.languages.registerHoverProvider(
      { pattern: "**" },
      {
        provideHover(document, position) {
          return provideHover(document, position);
        }
      }
    );
    const disposable = vscode2.commands.registerCommand("llm.generateCode", async () => {
      console.log("Command llm.generateCode executed");
    });
    const helloWorldCommand = vscode2.commands.registerCommand("devalley.helloWorld", () => {
      console.log("Command devalley.helloWorld executed");
      vscode2.window.showInformationMessage("Hello World from DevAlley!");
    });
    const generateCodeCommand = vscode2.commands.registerCommand("devalley.generateCode", async () => {
      const editor = vscode2.window.activeTextEditor;
      if (!editor) {
        vscode2.window.showWarningMessage("No active editor found");
        return;
      }
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      if (selectedText) {
        const prompt = `Generate code based on this comment or description: ${selectedText}`;
        try {
          const response = await queryBackendForCompletion(prompt);
          if (response) {
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, response);
            });
          }
        } catch (error) {
          vscode2.window.showErrorMessage("Failed to generate code: " + error);
        }
      } else {
        const description = await vscode2.window.showInputBox({
          prompt: "Describe the code you want to generate",
          placeHolder: 'e.g., "function to sort an array of objects by name"'
        });
        if (description) {
          try {
            const response = await queryBackendForCompletion(description);
            if (response) {
              await editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, response);
              });
            }
          } catch (error) {
            vscode2.window.showErrorMessage("Failed to generate code: " + error);
          }
        }
      }
    });
    const toggleCompletionsCommand = vscode2.commands.registerCommand("devalley.toggleCompletions", async () => {
      const config = vscode2.workspace.getConfiguration("devalley");
      const currentState = config.get("completions.enabled", true);
      await config.update("completions.enabled", !currentState, vscode2.ConfigurationTarget.Global);
      vscode2.window.showInformationMessage(
        `DevAlley completions ${!currentState ? "enabled" : "disabled"}`
      );
    });
    sidebarProvider.setMessageHandler(async (message) => {
      try {
        console.log("Extension host received message:", message);
        const response = await queryBackend(message);
        sidebarProvider.sendResponse(response);
      } catch (error) {
        console.error("Extension host error:", error);
        sidebarProvider.sendError(error.message);
      }
    });
    context.subscriptions.push(
      disposable,
      helloWorldCommand,
      generateCodeCommand,
      toggleCompletionsCommand,
      completionProvider,
      inlineCompletionProvider,
      hoverProvider
    );
    console.log("DevAlley extension activation COMPLETED successfully!");
    vscode2.window.showInformationMessage("DevAlley extension activated!");
  } catch (error) {
    console.error("DevAlley extension activation FAILED:", error);
    vscode2.window.showErrorMessage("DevAlley extension failed to activate: " + error);
  }
}
async function provideCompletions(document, position, token, context) {
  try {
    const config = vscode2.workspace.getConfiguration("devalley");
    if (!config.get("completions.enabled", true)) {
      return [];
    }
    const maxSuggestions = config.get("completions.maxSuggestions", 5);
    const line = document.lineAt(position);
    const wordRange = document.getWordRangeAtPosition(position);
    const currentWord = wordRange ? document.getText(wordRange) : "";
    const contextLines = Math.max(0, position.line - 10);
    const contextRange = new vscode2.Range(contextLines, 0, position.line, position.character);
    const contextText = document.getText(contextRange);
    if (currentWord.length < 2 && context.triggerKind !== vscode2.CompletionTriggerKind.Invoke) {
      return [];
    }
    const prompt = `Provide ${maxSuggestions} code completions for the following context:

Language: ${document.languageId}
File: ${document.fileName}
Context:
${contextText}

Current word being typed: "${currentWord}"
Current line: "${line.text}"

Please provide completions as JSON array with format:
[{"text": "completion", "detail": "description", "kind": "function|variable|class|method|property|snippet"}]

Only return the JSON array, no other text.`;
    const response = await queryBackendForCompletion(prompt);
    const suggestions = parseCompletionResponse(response);
    return suggestions.slice(0, maxSuggestions).map((suggestion, index) => {
      const completionItem = new vscode2.CompletionItem(
        suggestion.text,
        toVscodeKind(suggestion.kind)
        // ✅ FIXED
      );
      completionItem.detail = suggestion.detail || "DevAlley AI suggestion";
      completionItem.documentation = new vscode2.MarkdownString(suggestion.documentation || "");
      completionItem.insertText = suggestion.insertText || suggestion.text;
      completionItem.sortText = `0${index.toString().padStart(2, "0")}`;
      completionItem.filterText = suggestion.text;
      return completionItem;
    });
  } catch (error) {
    console.error("Completion provider error:", error);
    return [];
  }
}
async function provideHover(document, position) {
  try {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return;
    const word = document.getText(wordRange);
    if (word.length < 3) return;
    const line = document.lineAt(position.line);
    const contextRange = new vscode2.Range(
      Math.max(0, position.line - 3),
      0,
      Math.min(document.lineCount - 1, position.line + 3),
      0
    );
    const context = document.getText(contextRange);
    const prompt = `Explain this ${document.languageId} code element: "${word}"

Context:
${context}

Provide a brief explanation of what this is and how it's used. Keep it concise.`;
    const response = await queryBackendForCompletion(prompt);
    if (response && response.trim()) {
      const markdown = new vscode2.MarkdownString();
      markdown.appendMarkdown(`**${word}** (DevAlley AI)

${response}`);
      return new vscode2.Hover(markdown, wordRange);
    }
  } catch (error) {
    console.error("Hover provider error:", error);
  }
  return void 0;
}
function toVscodeKind(kind) {
  if (typeof kind === "number") return kind;
  return getCompletionKind(kind);
}
function getCompletionKind(kind) {
  switch (kind?.toLowerCase()) {
    case "function":
      return vscode2.CompletionItemKind.Function;
    case "method":
      return vscode2.CompletionItemKind.Method;
    case "variable":
      return vscode2.CompletionItemKind.Variable;
    case "class":
      return vscode2.CompletionItemKind.Class;
    case "property":
      return vscode2.CompletionItemKind.Property;
    case "snippet":
      return vscode2.CompletionItemKind.Snippet;
    case "keyword":
      return vscode2.CompletionItemKind.Keyword;
    case "module":
      return vscode2.CompletionItemKind.Module;
    case "interface":
      return vscode2.CompletionItemKind.Interface;
    default:
      return vscode2.CompletionItemKind.Text;
  }
}
async function queryBackendForCompletion(prompt) {
  try {
    const response = await fetch("http://192.168.1.10:9090/query_completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VSCode-DevAlley-Extension"
      },
      body: JSON.stringify({
        message: prompt,
        type: "completion",
        timeout: 5e3
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Completion backend request failed:", error);
    try {
      const fallbackResponse = await fetch("http://192.168.1.10:9090/query_aatma", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "VSCode-DevAlley-Extension"
        },
        body: JSON.stringify({ message: prompt })
      });
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        return data.response;
      }
    } catch (fallbackError) {
      console.error("Fallback request also failed:", fallbackError);
    }
    return "";
  }
}
function parseCompletionResponse(response) {
  try {
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.replace(/```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, "");
    }
    const parsed = JSON.parse(cleanResponse);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        text: item.text || item.completion || item.label || "",
        kind: item.kind || "text",
        detail: item.detail || item.description || "",
        documentation: item.documentation || item.docs || "",
        insertText: item.insertText || item.text || item.completion || ""
      }));
    }
  } catch (parseError) {
    console.log("Failed to parse as JSON, falling back to text parsing:", parseError);
    const lines = response.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && !line.startsWith("//")).slice(0, 10);
    return lines.map((line) => {
      const funcMatch = line.match(/(\w+)\s*\(/);
      const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);
      let kind = "text";
      if (funcMatch?.[1]) kind = "function";
      else if (varMatch?.[1]) kind = "variable";
      else if (line.includes("class ")) kind = "class";
      else if (line.includes("=>") || line.includes("function")) kind = "function";
      return {
        text: line,
        kind,
        detail: "AI suggestion",
        documentation: "",
        insertText: line
      };
    });
  }
  return [];
}
async function queryBackend(message) {
  console.log("Making request to backend:", message);
  try {
    const response = await fetch("http://192.168.1.10:9090/query_aatma", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VSCode-DevAlley-Extension"
      },
      body: JSON.stringify({ message })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Backend response received");
    return data.response;
  } catch (error) {
    console.error("Backend request failed:", error);
    throw new Error(`Backend error: ${error.message}`);
  }
}
function deactivate() {
  console.log("DevAlley extension is being deactivated...");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
