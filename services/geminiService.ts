import { GoogleGenAI } from "@google/genai";

// Ensure you have the API_KEY in your environment variables
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("Missing API_KEY environment variable.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export const generateComponent = async (prompt: string): Promise<string> => {
    const systemInstruction = `You are an expert React/Tailwind developer. You will be given a prompt to create a React component.
Your response MUST be the raw JSX code for the component and NOTHING ELSE.
Do not wrap the code in markdown backticks like \`\`\`jsx.
Do not include any explanation, titles, or descriptive text before or after the code.
Your entire response should be only the code.
Your response must start directly with the component definition, for example: 'const MyComponent = () => { ... };'
The component must be a single, self-contained React functional component.
Use only Tailwind CSS for styling. Do not use inline styles, custom CSS, or CSS-in-JS libraries.
Do not include 'import React from "react"' or 'export default'.
Assume React and its hooks (useState, useEffect, useCallback, etc.) are globally available.
Ensure the JSX is valid and all tags are properly closed.
Use placeholder data (e.g., from picsum.photos for images) if necessary to make the component functional and visually complete.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                // Disable thinking for faster, more direct code generation
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        
        let code = response.text.trim();
        
        // First, try to extract from a markdown block. This handles cases where the model ignores the instruction to not use them.
        const markdownMatch = code.match(/```(?:jsx?|tsx?|javascript?|js?)\n([\s\S]+)```/);
        if (markdownMatch && markdownMatch[1]) {
            return markdownMatch[1].trim();
        }
        
        // If no markdown block, the model might have returned raw code with extra text prepended (like a title).
        // Find the start of a React component definition and discard anything before it.
        const codeStartIndex = code.search(/^(export\s+)?(const|function|\(\s*\)\s*=>|function\s*\w+\s*\()/m);
        if (codeStartIndex !== -1) {
            return code.substring(codeStartIndex);
        }

        // If we can't find a clear start, return the original (trimmed) string.
        // This will likely fail in Babel, which is the desired behavior to signal an issue.
        return code;

    } catch (error) {
        console.error("Error generating component with Gemini:", error);
        if (error instanceof Error) {
            return `// Error: Failed to generate component. ${error.message}`;
        }
        return "// Error: An unknown error occurred."
    }
};