Objective

Create a modular AI service using the Grok API that can power multiple AI features throughout the application.

The implementation must be:

Modular
Type-safe
Extensible
Streaming-ready
Production-ready
Easy to replace with another provider in the future

The UI already exists. Implement only the backend service layer and frontend integration.

AI Features

Implement the following AI capabilities.

1. Ask About Current Document

User can ask:

What is this document about?
Explain section 2
Summarize this page
What are the important points?

Input

Current markdown document.

Output

AI response.

2. Explain Selected Text

User selects text.

Clicks

Explain

AI returns

Simplified explanation
Technical explanation
Beginner explanation

3. Summarize Document

Three modes

Short

Medium

Detailed

4. Improve Writing

Rewrite selected markdown.

Options

Professional

Simple

Technical

Academic

Friendly

Do not modify markdown syntax.

5. Grammar Correction

Return corrected markdown.

Preserve formatting.

6. Generate Table of Contents

Generate TOC based on headings.

Return markdown.

7. Generate Mermaid Diagram

Input

Plain English

Output

Mermaid code block.

Example

flowchart TD

A --> B

8. Convert Notes to Markdown

Input

Plain text.

Output

Proper markdown.

Generate

headings
bullet lists
tables
code blocks

9. Translate

Languages

English

Hindi

French

German

Japanese

Spanish

Preserve markdown.

10. Generate FAQ

Generate FAQ section.

Markdown format.

11. Create Flashcards

Output

Question

Answer

Markdown table.

12. Generate Interview Questions

Return

Easy

Medium

Hard

Based on document.



## 13. Document Insights

Return

* Reading time
* Difficulty
* Main topics
* Keywords
* Missing sections
* Suggestions

---

## 14. Title Generator

Generate

5 titles.

---

## 15. AI Chat

Persistent conversation.

Conversation is always aware of

Current markdown.

---

# Context System

The model should always receive

Current markdown

File name

Current heading

Selected text

Cursor location

Workspace name

Recent prompts

Conversation history

Build a reusable

```
buildContext()
```

function.

---

# Prompt Builder

Create reusable prompts.

Functions

```
buildSummaryPrompt()

buildExplainPrompt()

buildGrammarPrompt()

buildRewritePrompt()

buildTranslationPrompt()

buildMermaidPrompt()

buildFAQPrompt()

buildFlashcardPrompt()
```

Avoid duplicated prompt strings.

---

# AI Service

Expose a clean API.

```
summarize()

rewrite()

translate()

chat()

generateTOC()

generateFAQ()

generateMermaid()

improveWriting()

grammarCheck()

createFlashcards()

generateInterviewQuestions()

analyzeDocument()
```

---

# Streaming

Support streaming responses.

Display text as it arrives.

Provide

start()

stop()

cancel()

callbacks.

---

# AI Store

Using Zustand

State

```
loading

streaming

messages

history

currentResponse

selectedText

currentDocument

error
```

Actions

```
sendMessage()

cancel()

clear()

retry()

reset()
```

---

# Error Handling

Handle

401

403

404

429

500

Network timeout

Rate limit

Abort request

Display user-friendly errors.

---

# Rate Limiting

Prevent rapid repeated requests.

Debounce

1 second.

---

# Token Management

Avoid sending unnecessary data.

Limit

Conversation history.

Truncate large documents.

Keep selected text when possible.

---

# Markdown Preservation

AI must preserve

```
#

##

###

Tables

Code blocks

Lists

Mermaid

Math

Images

Links
```

Never destroy formatting.

---

# AI Response Rendering

Support

Markdown

Tables

Code

Mermaid

Math

Syntax highlighting

Copy button

Regenerate button

Insert into editor

Replace selection

---

# Keyboard Shortcuts

Ctrl + I

Open AI

Ctrl + Enter

Submit

Esc

Close

---

# Type Definitions

Create strong TypeScript interfaces.

Example

```
AIMessage

AIResponse

ChatRequest

ChatResponse

PromptType

StreamingChunk

DocumentContext
```

No use of `any`.

---

# Performance

Memoize prompts.

Lazy load AI panel.

Abort previous request.

Cache repeated prompts.

---

# Security

Never expose API keys in source control.

Sanitize markdown before rendering AI responses.

Escape HTML where required.

---

# Future Provider Support

The architecture should make it easy to replace Grok with another provider such as OpenAI, Anthropic, Gemini, or Ollama by changing only the client implementation.

---

# Code Quality Requirements

* TypeScript strict mode
* Fully typed
* Modular architecture
* Reusable services
* Small focused functions
* No duplicated logic
* Comprehensive comments for public APIs
* Async/await (no callback chains)
* Clean error handling
* Production-ready code

---

# Deliverables

Implement:

* AI service layer
* Grok client
* Prompt builder
* Context builder
* Streaming support
* Zustand store
* React hooks
* TypeScript types
* Reusable AI UI components
* Error handling
* Example integration with the Markdown editor

The implementation should be scalable so additional AI features can be added without major refactoring.
