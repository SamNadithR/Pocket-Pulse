
// Supabase Edge Function: financial-advisor
// Deploy: supabase functions deploy financial-advisor
// Set secret: supabase secrets set GEMINI_API_KEY=your_key

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const auth = req.headers.get("Authorization") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: auth }
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            ...cors,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const body = await req.json();

    const question = String(body.question || "").slice(0, 2000);
    const context = JSON.stringify(body.context || {}).slice(0, 8000);

    if (!question.trim()) {
      return new Response(
        JSON.stringify({ error: "Question required" }),
        {
          status: 400,
          headers: {
            ...cors,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const key = Deno.env.get("GEMINI_API_KEY");

    if (!key) {
      throw new Error("Gemini is not configured");
    }

    const prompt = `You are PocketPulse, a careful personal finance coach for a motorcycle delivery rider in Colombo, Sri Lanka. Give practical, non-judgmental advice in LKR. Consider cash flow, savings targets, fuel/maintenance costs, safety and emergency reserves. Never claim guaranteed returns, never recommend unsafe riding or illegal activity, and do not invent account data. Context from the authenticated user's app: ${context}
User question: ${question}
Keep the response concise and clearly distinguish estimates from facts. This is general information, not regulated financial advice.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 700
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || "Gemini request failed");
    }

    const answer =
      result.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") ||
      "I couldn't generate a reply just now.";

    return new Response(
      JSON.stringify({ answer }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Server error"
      }),
      {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
