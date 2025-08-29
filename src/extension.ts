import * as vscode from "vscode";
import { SidebarProvider } from "./SidebarProvider";

interface ApiResponse {
  response: string;
}

interface CompletionSuggestion {
  text: string;
  kind?: string | vscode.CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

// Centralized Backend Service with Authentication
class BackendService {
  private baseUrl = "http://192.168.1.10:9090";
  private authToken: string | null = null;
  
  // Set authentication token
  setAuthToken(token: string | null) {
    this.authToken = token;
  }
  
  // Get authentication token
  getAuthToken(): string | null {
    return this.authToken;
  }
  
  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.authToken;
  }
  
  // Get common headers with authentication
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "VSCode-DevAlley-Extension"
    };
    
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
      headers["X-Auth-Token"] = this.authToken;
    }
    
    return headers;
  }
  
  // Unified backend query method
  async query(endpoint: string, payload: any): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error('Authentication required. Please log in first.');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ApiResponse;
      return data.response;
    } catch (error: any) {
      console.error(`Backend request to ${endpoint} failed:`, error);
      throw new Error(`Backend error: ${error.message}`);
    }
  }
  
  // Chat query
  async queryChat(message: string): Promise<string> {
    console.log('Making authenticated chat request to backend:', message);
    return this.query("/query_aatma", { message });
  }
  
  // Completion query with fallback
  async queryCompletion(prompt: string): Promise<string> {
    try {
      return await this.query("/query_completion", {
        message: prompt,
        type: "completion",
        timeout: 5000
      });
    } catch (error) {
      console.error('Completion request failed, trying fallback:', error);
      
      // Fallback to chat endpoint
      try {
        return await this.query("/query_aatma", { message: prompt });
      } catch (fallbackError) {
        console.error('Fallback request also failed:', fallbackError);
        return ""; // Return empty string instead of throwing
      }
    }
  }
}

// Create singleton instance
const backendService = new BackendService();

// Global reference to sidebar provider
let sidebarProvider: SidebarProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('DevAlley extension STARTING activation...');

  try {
    sidebarProvider = new SidebarProvider(context.extensionUri);
    console.log('SidebarProvider created successfully');

    // Register webview provider
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider
      )
    );

    // Register completion provider for all languages
    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { pattern: '**' }, // All files
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
          context: vscode.CompletionContext
        ) {
          return provideCompletions(document, position, token, context);
        }
      },
      '.', '(', '"', "'", ' ', '\n'
    );

    // Inline completion provider
    const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      {
        provideInlineCompletionItems: async (document, position, context, token) => {
          const config = vscode.workspace.getConfiguration('devalley');
          if (!config.get('completions.enabled', true)) {
            return [];
          }

          // Check authentication
          if (!sidebarProvider.isAuthenticated()) {
            return [];
          }

          // Update backend service token from sidebar provider
          backendService.setAuthToken(sidebarProvider.getAuthToken());

          try {
            const startLine = Math.max(0, position.line - 20);
            const textBeforeCursor = document.getText(
              new vscode.Range(startLine, 0, position.line, position.character)
            );

            const currentLine = document.lineAt(position.line);
            const textAfterCursor = currentLine.text.substring(position.character);

            const prompt = `Complete this ${document.languageId} code:

Context:
${textBeforeCursor}|CURSOR|${textAfterCursor}

Provide a single completion that continues from the cursor position. Only return the completion text, nothing else.`;

            const response = await backendService.queryCompletion(prompt);

            if (response && response.trim()) {
              return [
                new vscode.InlineCompletionItem(
                  response.trim(),
                  new vscode.Range(position, position)
                )
              ];
            }
          } catch (error) {
            console.error('Inline completion error:', error);
          }

          return [];
        }
      }
    );

    // Hover provider
    const hoverProvider = vscode.languages.registerHoverProvider(
      { pattern: '**' },
      {
        provideHover(document, position) {
          return provideHover(document, position);
        }
      }
    );

    // Commands
    const disposable = vscode.commands.registerCommand("llm.generateCode", async () => {
      console.log('Command llm.generateCode executed');
    });

    const helloWorldCommand = vscode.commands.registerCommand("devalley.helloWorld", () => {
      console.log('Command devalley.helloWorld executed');
      vscode.window.showInformationMessage("Hello World from DevAlley!");
    });

    const generateCodeCommand = vscode.commands.registerCommand("devalley.generateCode", async () => {
      // Check authentication first
      if (!sidebarProvider.isAuthenticated()) {
        vscode.window.showWarningMessage('Please log in first to use DevAlley features');
        return;
      }

      // Update backend service token
      backendService.setAuthToken(sidebarProvider.getAuthToken());

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (selectedText) {
        const prompt = `Generate code based on this comment or description: ${selectedText}`;
        try {
          const response = await backendService.queryCompletion(prompt);
          if (response) {
            await editor.edit(editBuilder => {
              editBuilder.replace(selection, response);
            });
          }
        } catch (error) {
          vscode.window.showErrorMessage('Failed to generate code: ' + error);
        }
      } else {
        const description = await vscode.window.showInputBox({
          prompt: 'Describe the code you want to generate',
          placeHolder: 'e.g., "function to sort an array of objects by name"'
        });

        if (description) {
          try {
            const response = await backendService.queryCompletion(description);
            if (response) {
              await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, response);
              });
            }
          } catch (error) {
            vscode.window.showErrorMessage('Failed to generate code: ' + error);
          }
        }
      }
    });

    const toggleCompletionsCommand = vscode.commands.registerCommand("devalley.toggleCompletions", async () => {
      const config = vscode.workspace.getConfiguration('devalley');
      const currentState = config.get('completions.enabled', true);
      await config.update('completions.enabled', !currentState, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `DevAlley completions ${!currentState ? 'enabled' : 'disabled'}`
      );
    });

    // Sidebar message handler - updated to use backend service
    sidebarProvider.setMessageHandler(async (message: string) => {
      try {
        console.log('Extension host received message:', message);
        
        // Update backend service token from sidebar provider
        backendService.setAuthToken(sidebarProvider.getAuthToken());
        
        const response = await backendService.queryChat(message);
        sidebarProvider.sendResponse(response);
      } catch (error: any) {
        console.error('Extension host error:', error);
        sidebarProvider.sendError(error.message);
      }
    });

    // Subscriptions
    context.subscriptions.push(
      disposable,
      helloWorldCommand,
      generateCodeCommand,
      toggleCompletionsCommand,
      completionProvider,
      inlineCompletionProvider,
      hoverProvider
    );

    console.log('DevAlley extension activation COMPLETED successfully!');
    vscode.window.showInformationMessage('DevAlley extension activated!');

  } catch (error) {
    console.error('DevAlley extension activation FAILED:', error);
    vscode.window.showErrorMessage('DevAlley extension failed to activate: ' + error);
  }
}

// Completion provider
async function provideCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken,
  context: vscode.CompletionContext
): Promise<vscode.CompletionItem[]> {
  try {
    const config = vscode.workspace.getConfiguration('devalley');
    if (!config.get('completions.enabled', true)) {
      return [];
    }

    // Check authentication
    if (!sidebarProvider.isAuthenticated()) {
      return [];
    }

    // Update backend service token
    backendService.setAuthToken(sidebarProvider.getAuthToken());

    const maxSuggestions = config.get('completions.maxSuggestions', 5);

    const line = document.lineAt(position);
    const wordRange = document.getWordRangeAtPosition(position);
    const currentWord = wordRange ? document.getText(wordRange) : '';

    const contextLines = Math.max(0, position.line - 10);
    const contextRange = new vscode.Range(contextLines, 0, position.line, position.character);
    const contextText = document.getText(contextRange);

    if (currentWord.length < 2 && context.triggerKind !== vscode.CompletionTriggerKind.Invoke) {
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

    const response = await backendService.queryCompletion(prompt);
    const suggestions = parseCompletionResponse(response);

    return suggestions.slice(0, maxSuggestions).map((suggestion, index) => {
      const completionItem = new vscode.CompletionItem(
        suggestion.text,
        toVscodeKind(suggestion.kind)
      );

      completionItem.detail = suggestion.detail || 'DevAlley AI suggestion';
      completionItem.documentation = new vscode.MarkdownString(suggestion.documentation || '');
      completionItem.insertText = suggestion.insertText || suggestion.text;
      completionItem.sortText = `0${index.toString().padStart(2, '0')}`;
      completionItem.filterText = suggestion.text;

      return completionItem;
    });

  } catch (error) {
    console.error('Completion provider error:', error);
    return [];
  }
}

// Hover provider
async function provideHover(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Hover | undefined> {
  try {
    // Check authentication
    if (!sidebarProvider.isAuthenticated()) {
      return undefined;
    }

    // Update backend service token
    backendService.setAuthToken(sidebarProvider.getAuthToken());

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return;
    }

    const word = document.getText(wordRange);
    if (word.length < 3) {
      return;
    }

    const line = document.lineAt(position.line);
    const contextRange = new vscode.Range(
      Math.max(0, position.line - 3), 0,
      Math.min(document.lineCount - 1, position.line + 3), 0
    );
    const context = document.getText(contextRange);

    const prompt = `Explain this ${document.languageId} code element: "${word}"

Context:
${context}

Provide a brief explanation of what this is and how it's used. Keep it concise.`;

    const response = await backendService.queryCompletion(prompt);

    if (response && response.trim()) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**${word}** (DevAlley AI)\n\n${response}`);
      return new vscode.Hover(markdown, wordRange);
    }
  } catch (error) {
    console.error('Hover provider error:', error);
  }

  return undefined;
}

// Convert string|enum kind → VSCode CompletionItemKind
function toVscodeKind(kind?: string | vscode.CompletionItemKind): vscode.CompletionItemKind {
  if (typeof kind === "number") {
    return kind;
  }
  return getCompletionKind(kind);
}

// String → VSCode CompletionItemKind
function getCompletionKind(kind?: string): vscode.CompletionItemKind {
  switch (kind?.toLowerCase()) {
    case 'function': return vscode.CompletionItemKind.Function;
    case 'method': return vscode.CompletionItemKind.Method;
    case 'variable': return vscode.CompletionItemKind.Variable;
    case 'class': return vscode.CompletionItemKind.Class;
    case 'property': return vscode.CompletionItemKind.Property;
    case 'snippet': return vscode.CompletionItemKind.Snippet;
    case 'keyword': return vscode.CompletionItemKind.Keyword;
    case 'module': return vscode.CompletionItemKind.Module;
    case 'interface': return vscode.CompletionItemKind.Interface;
    default: return vscode.CompletionItemKind.Text;
  }
}

// Parse completion response
function parseCompletionResponse(response: string): CompletionSuggestion[] {
  try {
    let cleanResponse = response.trim();

    // Strip ```json ... ``` blocks
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.replace(/```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, "");
    }

    const parsed = JSON.parse(cleanResponse);
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        text: item.text || item.completion || item.label || '',
        kind: item.kind || 'text',
        detail: item.detail || item.description || '',
        documentation: item.documentation || item.docs || '',
        insertText: item.insertText || item.text || item.completion || ''
      }));
    }
  } catch (parseError) {
    console.log('Failed to parse as JSON, falling back to text parsing:', parseError);

    const lines = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
      .slice(0, 10);

    return lines.map(line => {
      const funcMatch = line.match(/(\w+)\s*\(/);
      const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);

      let kind: string = 'text';
      if (funcMatch?.[1]) {
        kind = 'function';
      } else if (varMatch?.[1]) {
        kind = 'variable';
      } else if (line.includes('class ')) {
        kind = 'class';
      } else if (line.includes('=>') || line.includes('function')) {
        kind = 'function';
      }

      return {
        text: line,
        kind,
        detail: 'AI suggestion',
        documentation: '',
        insertText: line
      };
    });
  }

  return [];
}

export function deactivate() {
  console.log('DevAlley extension is being deactivated...');
}

