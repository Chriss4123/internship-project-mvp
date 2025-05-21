import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold
} from '@google/genai';

const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { field, roles, location, selectedJobDetails } = await request.json();

    if (!field || !roles || roles.length === 0 || !selectedJobDetails || selectedJobDetails.length === 0) {
      return NextResponse.json({ error: 'Missing required fields for project generation' }, { status: 400 });
    }

    const genAI = new GoogleGenAI({ apiKey: API_KEY });

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    const config = {
      temperature: 0.7,
      topK: 1,
      topP: 1,
      maxOutputTokens: 16384,
      tools: [{ googleSearch: {} }],
      safetySettings,
    };

    const jobDetailsString = selectedJobDetails.map((job: { title: string, description: string, company: string }) =>
      `Company: ${job.company}\nTitle: ${job.title}\nDescription: ${job.description.substring(0, 300)}...`
    ).join('\n\n---\n\n');

    const prompt = `
      You are an expert career advisor helping a graduate find an impressive project for their resume.
      The graduate is interested in the general field of "${field}" and specifically in the roles: ${roles.join(', ')}.
      They are looking for opportunities near "${location}".

      They have identified the following job postings as particularly interesting:
      ${jobDetailsString}

      Based on these preferences and the common requirements/skills sought by companies hiring for these roles (as exemplified by the job descriptions),
      propose a specific, **actionable project that a graduate can realistically complete within *one week* of focused work** (keep the scope reasonable, nothing too crazy).
      
      The project should NOT be too simple (e.g., "Hello World" or basic CRUD apps), and should demonstrate both **breadth and depth in technical skills** relevant to the target roles. However, do not propose an enterprise-level or unreasonably large project for one week.

      Your output MUST be a JSON object with the following structure:
      {
        "projectTitle": "A concise and catchy title for the project",
        "projectDescription": "A 2-3 sentence description of the project, explaining its purpose and relevance to the target roles/companies.",
        "projectAppeal": "A short paragraph (2-4 sentences) explaining WHY this project would appeal to the companies based on the job descriptions provided and general industry knowledge for the field/roles.",
        "keySkillsDemonstrated": "Skill 1, Skill 2, Skill 3 (e.g., Python, Data Analysis, Problem Solving)",
        "projectChecklist": [
          "A clear, actionable step 1 for the project",
          "Actionable step 2",
          "Actionable step 3",
          "...",
          "Final step (e.g., 'Deploy the project' or 'Write a report summarizing findings')"
        ],
        "skillsRequired": "I see that these companies use Next.js, AWS, ...",

        "markdownReport": "# 🚀 Title\\n\\nShort intro...\\n\\n## Why this project will impress\\n...\\n\\n### Key skills\\nPython, Next.js\\n\\n### Project checklist\\n* [ ] step one\\n* [ ] step two"
      }

      Additional formatting requirements:
      • Render *all* textual fields (except arrays) using Markdown where appropriate.  
      • Use **clear Markdown headings** (#, ##, ###) to separate sections inside any multi-line Markdown strings (e.g., projectDescription, projectAppeal, markdownReport).  
      • Inside **markdownReport**, include a checklist with \`* [ ]\` items ready for GitHub README usage.  
      • The \`markdownReport\` MUST NOT cite or reference web results or sources.
    `;

    const parts = [{ text: prompt }];
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: [{ role: "user", parts }],
      config,
    });

    if (!result.candidates) {
      console.error("Gemini API error: No response object", result);
      throw new Error("Gemini API did not return a response.");
    }

    const groundingMeta = result.candidates[0].groundingMetadata ?? {};
    const renderedHtml = groundingMeta.searchEntryPoint?.renderedContent as string | undefined;
    const webSearchQueries = groundingMeta.webSearchQueries as string[] | undefined;

    const responseText = result.candidates[0].content?.parts?.[0]?.text;

    let jsonString = responseText ?? "";

    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = jsonString.match(codeBlockRegex);

    if (match && match[1]) {
      jsonString = match[1].trim();
    } else if (jsonString.startsWith("```json")) {
      jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }

    try {
      const projectIdea = JSON.parse(jsonString);
      return NextResponse.json({
        ...projectIdea,
        groundingHtml: renderedHtml,
        webSearchQueries
      });
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini response:", parseError);
      console.error("Original Gemini response text:", responseText);
      return NextResponse.json({
        error: "Failed to parse project idea from LLM. Raw response included.",
        rawResponse: responseText,
        groundingHtml: renderedHtml,
        webSearchQueries
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: 'Failed to generate project idea from Gemini API', details: error.message }, { status: 500 });
  }
}