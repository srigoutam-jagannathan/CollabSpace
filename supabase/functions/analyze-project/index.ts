/**
 * CollabSpace Edge Function: analyze-project
 *
 * Phase 1 — BYO-AI (Bring Your Own AI)
 *
 * Accepts a project description and returns three tailored "Sub-Agent Prompts"
 * that the user can paste directly into their personal AI account (ChatGPT,
 * Gemini, Claude, etc.) to get specialist guidance across Legal, Tech, and
 * Marketing dimensions.
 *
 * Deploy:  supabase functions deploy analyze-project
 * Invoke:  POST /functions/v1/analyze-project
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyzeProjectRequest {
  project_description: string;
  looking_for?: string[];       // Roles the project is recruiting for
  tags?: string[];              // Tech/domain tags
}

interface SubAgentPrompt {
  domain: "legal" | "tech" | "marketing";
  label: string;
  system_prompt: string;
  starter_question: string;
}

interface AnalyzeProjectResponse {
  sub_agent_prompts: SubAgentPrompt[];
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: AnalyzeProjectRequest;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { project_description, looking_for = [], tags = [] } = body;

  if (!project_description || project_description.trim().length < 20) {
    return new Response(
      JSON.stringify({ error: "project_description must be at least 20 characters." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Build contextual metadata string ──────────────────────────────────────
  const rolesClause = looking_for.length
    ? `The team is currently looking for: ${looking_for.join(", ")}.`
    : "";
  const tagsClause = tags.length
    ? `Relevant domains / technologies: ${tags.join(", ")}.`
    : "";
  const contextClause = [rolesClause, tagsClause].filter(Boolean).join(" ");

  // ── Generate Sub-Agent Prompts ─────────────────────────────────────────────
  const prompts: SubAgentPrompt[] = [
    {
      domain: "legal",
      label: "Legal Sub-Agent",
      system_prompt: `You are a specialist legal advisor with expertise in UK startup law,
intellectual property (IP) agreements, student collaboration frameworks, and GDPR compliance.
You are advising a team of university students in Northern Ireland who are building the following project:

"""
${project_description}
"""
${contextClause}

Your role is to identify legal risks, suggest protective structures (IP assignments,
non-disclosure considerations, revenue-share frameworks), and ensure the team understands
their obligations — all in plain English suitable for non-lawyers.
Always note when professional legal counsel should be sought.`,
      starter_question:
        "What IP ownership and revenue-sharing structure should our student team adopt, and what are the key legal risks we should address before going public?",
    },
    {
      domain: "tech",
      label: "Tech Sub-Agent",
      system_prompt: `You are a senior software architect and full-stack engineer
with deep expertise in modern web and mobile development stacks.
You are advising a student team in Northern Ireland building the following project:

"""
${project_description}
"""
${contextClause}

Your role is to review their technical direction, identify architectural gaps and scaling
risks, recommend the best-fit tech stack components, and provide concrete next-step
implementation advice. Be specific — name libraries, patterns, and trade-offs.
Prioritise approaches a student team can ship quickly with limited budget.`,
      starter_question:
        "Given our project scope and team, what is the optimal tech stack and what are the three most critical technical risks we should de-risk first?",
    },
    {
      domain: "marketing",
      label: "Marketing Sub-Agent",
      system_prompt: `You are a growth strategist and product marketer specialising
in early-stage B2C and B2B2C products targeting Gen-Z and student audiences in the UK.
You are advising a student team in Northern Ireland building the following project:

"""
${project_description}
"""
${contextClause}

Your role is to help them define their unique value proposition, identify their beachhead
market within the QUB/Ulster University student ecosystem, design a zero-budget go-to-market
strategy, and outline metrics that will make the product attractive to future investors or
grant bodies (e.g. Invest NI, UK Research and Innovation).`,
      starter_question:
        "What is our strongest value proposition for the QUB/Ulster student audience, and what is a realistic zero-budget launch plan for the first 100 users?",
    },
  ];

  const response: AnalyzeProjectResponse = { sub_agent_prompts: prompts };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
