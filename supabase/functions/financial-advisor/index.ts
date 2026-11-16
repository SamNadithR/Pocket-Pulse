import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/genai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, context } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY secret is not configured in Supabase.")
    }

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const systemPrompt = `You are PocketPulse Gemini AI Advisor, a world-class fintech assistant built for young adults, freelancers, and delivery riders in Sri Lanka.
    User financial context:
    - Wallets: ${JSON.stringify(context.wallets)}
    - Recent Transactions: ${JSON.stringify(context.transactions.slice(0, 10))}
    - Savings Targets: ${JSON.stringify(context.targets)}
    - Fixed monthly baseline: LKR 62,000 (Rent 9k, Food/Transport 30k, Mobile 3k, Loan 20k)
    - Exchange rate planning default: 1 USD = 328.50 LKR.
    
    Provide helpful, practical, encouraging, and concise financial advice in LKR/USD. Never fabricate financial records. Emphasize smart budgeting and steady saving.`

    const result = await model.generateContent([systemPrompt, prompt])
    const responseText = result.response.text()

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
