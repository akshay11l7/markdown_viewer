export type AIAction = 'summary' | 'explain' | 'improve' | 'grammar' | 'translate' | 'toc' | 'mermaid' | 'markdown' | 'chat';

export async function askAI(action: AIAction, text: string, _context?: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  switch (action) {
    case 'summary':
      return `### Document Summary\n\nHere are the 5 key points from the document:\n\n1. **Core Subject**: The text discusses the fundamental aspects of the selected topic.\n2. **Main Argument**: It highlights the importance of integrating modern practices.\n3. **Key Finding**: The data suggests a significant improvement when applying these methods.\n4. **Implications**: This approach can scale effectively across different environments.\n5. **Conclusion**: Overall, the document provides a comprehensive overview of the strategies needed for success.`;
    
    case 'explain':
      return `**Explanation:**\n\nThis text means that the underlying system is designed to handle multiple concurrent requests without blocking the main thread. It achieves this by using asynchronous programming patterns, which allow the application to remain responsive while waiting for I/O operations (like network requests or file reading) to complete.`;
    
    case 'improve':
      return `**Improved version:**\n\n${text}\n\n*(Note: This is a simulated improvement. The writing has been refined for clarity, conciseness, and impact while maintaining the original tone.)*`;
      
    case 'grammar':
      return `**Corrected grammar:**\n\n${text}\n\n*(Note: Simulated correction. Fixed subject-verb agreement and punctuation errors.)*`;
      
    case 'translate':
      return `**Translation (Spanish):**\n\nEste es un texto traducido simulado. La herramienta de inteligencia artificial puede traducir automáticamente su contenido a varios idiomas manteniendo el formato original.`;
      
    case 'toc':
      return `### Table of Contents\n\n- [Introduction](#introduction)\n- [Getting Started](#getting-started)\n  - [Installation](#installation)\n  - [Configuration](#configuration)\n- [Advanced Features](#advanced-features)\n- [Conclusion](#conclusion)`;
      
    case 'mermaid':
      return `Here is the generated diagram:\n\n\`\`\`mermaid\ngraph TD;\n    A[Start] --> B{Is it valid?};\n    B -- Yes --> C[Process Data];\n    B -- No --> D[Show Error];\n    C --> E[Save to DB];\n    E --> F[End];\n    D --> F;\n\`\`\``;
      
    case 'markdown':
      return `### Formatted Markdown\n\nHere is the text converted to properly formatted Markdown:\n\n**${text.split('\n')[0]}**\n\n> This text was automatically structured by AI.\n\n- Point 1\n- Point 2`;
      
    case 'chat':
      if (text.toLowerCase().includes('interview')) {
         return `**Interview Questions:**\n\n1. Can you explain the main concept described in this document?\n2. What are the potential edge cases when implementing this architecture?\n3. How would you scale this solution for a million users?\n4. What alternative approaches did you consider and why did you choose this one?`;
      }
      return `Based on the document context, here is my response to your question: "${text}".\n\nThe document details several approaches to solving this problem. I recommend looking at the "Advanced Features" section for more specific guidance.`;
      
    default:
      return "I'm sorry, I couldn't process that request.";
  }
}
