import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

export const TriageOutputSchema = z.object({
    category: z.enum([
        "CARDIAC",
        "TRAUMA",
        "STROKE",
        "BURNS",
        "RESPIRATORY",
        "MATERNITY",
        "PEDIATRIC",
        "GENERAL",
    ]),
    severity: z.number().int().min(1).max(5),
    requiredSpecialty: z.string().min(1),
    needsICU: z.boolean(),
    reasoning: z.string().min(1),
});

export type TriageOutput = z.infer<typeof TriageOutputSchema>;

export interface TriageResult extends TriageOutput {
    aiSource: "LLM" | "RULES";
}

/**
 * Deterministic keyword-based rule engine.
 * Mandatory fallback when venue internet is disconnected, API key is missing, or latency exceeds 3 seconds.
 */
export function ruleBasedTriage(description: string, symptoms: string[] = []): TriageResult {
    const text = `${description} ${symptoms.join(" ")}`.toLowerCase();

    // 1. CARDIAC (Severity 5)
    if (
        text.includes("chest pain") ||
        text.includes("heart") ||
        text.includes("cardiac") ||
        text.includes("angina") ||
        text.includes("heart attack") ||
        text.includes("palpitation")
    ) {
        return {
            category: "CARDIAC",
            severity: 5,
            requiredSpecialty: "cardiac",
            needsICU: true,
            reasoning: "Rule-based match: Acute cardiac symptom profile detected (severe chest distress / possible infarction).",
            aiSource: "RULES",
        };
    }

    // 2. STROKE (Severity 5)
    if (
        text.includes("stroke") ||
        text.includes("slurred") ||
        text.includes("unconscious") ||
        text.includes("face droop") ||
        text.includes("paralysis") ||
        text.includes("fainting") ||
        text.includes("loss of consciousness")
    ) {
        return {
            category: "STROKE",
            severity: 5,
            requiredSpecialty: "neuro",
            needsICU: true,
            reasoning: "Rule-based match: Acute neurological compromise detected (FAST stroke indicators or altered consciousness).",
            aiSource: "RULES",
        };
    }

    // 3. BURNS (Severity 4)
    if (
        text.includes("burn") ||
        text.includes("fire") ||
        text.includes("scald") ||
        text.includes("acid") ||
        text.includes("flame") ||
        text.includes("smoke inhalation")
    ) {
        return {
            category: "BURNS",
            severity: 4,
            requiredSpecialty: "burns",
            needsICU: true,
            reasoning: "Rule-based match: Thermal or chemical trauma requiring specialized burn unit care.",
            aiSource: "RULES",
        };
    }

    // 4. TRAUMA (Severity 4)
    if (
        text.includes("accident") ||
        text.includes("bleeding") ||
        text.includes("fracture") ||
        text.includes("collision") ||
        text.includes("stab") ||
        text.includes("fall") ||
        text.includes("head injury") ||
        text.includes("crash")
    ) {
        return {
            category: "TRAUMA",
            severity: 4,
            requiredSpecialty: "trauma",
            needsICU: false,
            reasoning: "Rule-based match: Physical traumatic injury requiring immediate orthopedic or surgical stabilization.",
            aiSource: "RULES",
        };
    }

    // 5. RESPIRATORY (Severity 4)
    if (
        text.includes("breath") ||
        text.includes("suffocat") ||
        text.includes("choking") ||
        text.includes("asthma") ||
        text.includes("oxygen") ||
        text.includes("wheezing")
    ) {
        return {
            category: "RESPIRATORY",
            severity: 4,
            requiredSpecialty: "respiratory",
            needsICU: false,
            reasoning: "Rule-based match: Acute respiratory distress / compromised airway ventilation.",
            aiSource: "RULES",
        };
    }

    // 6. MATERNITY (Severity 4)
    if (
        text.includes("pregnan") ||
        text.includes("labour") ||
        text.includes("labor") ||
        text.includes("delivery") ||
        text.includes("water broke") ||
        text.includes("contractions")
    ) {
        return {
            category: "MATERNITY",
            severity: 4,
            requiredSpecialty: "maternity",
            needsICU: false,
            reasoning: "Rule-based match: Active labor or obstetric emergency requiring maternity care.",
            aiSource: "RULES",
        };
    }

    // 7. PEDIATRIC (Severity 3 or 4)
    if (
        text.includes("child") ||
        text.includes("infant") ||
        text.includes("baby") ||
        text.includes("toddler") ||
        text.includes("pediatric")
    ) {
        return {
            category: "PEDIATRIC",
            severity: 4,
            requiredSpecialty: "pediatric",
            needsICU: false,
            reasoning: "Rule-based match: Pediatric patient requiring specialized child care facility.",
            aiSource: "RULES",
        };
    }

    // 8. GENERAL (Severity 2)
    return {
        category: "GENERAL",
        severity: 2,
        requiredSpecialty: "general",
        needsICU: false,
        reasoning: "Rule-based match: General medical condition requiring standard clinical evaluation.",
        aiSource: "RULES",
    };
}

/**
 * Performs emergency triage using Google Gemini API with a strict 3-second timeout
 * and mandatory fallback to deterministic rule engine.
 *
 * NOTE: The output is decision support only, never a clinical diagnosis.
 */
export async function triageEmergency(params: {
    description: string;
    symptoms?: string[] | undefined;
}): Promise<TriageResult> {
    const { description, symptoms = [] } = params;
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.TRIAGE_MODEL || "gemini-2.5-flash";

    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
        return ruleBasedTriage(description, symptoms);
    }

    const systemPrompt = `You are a clinical decision-support triage assistant for emergency ambulance dispatch.
Analyze the caller's emergency description and classify it into triage attributes.
This output is decision support only for ambulance vehicle and hospital dispatch, never a clinical diagnosis.

You MUST reply with ONLY a single valid JSON object with NO markdown formatting, NO backticks, and NO extraneous text:
{
  "category": "CARDIAC" | "TRAUMA" | "STROKE" | "BURNS" | "RESPIRATORY" | "MATERNITY" | "PEDIATRIC" | "GENERAL",
  "severity": <integer 1 to 5, where 1 is non-urgent and 5 is immediately life-threatening>,
  "requiredSpecialty": "<cardiac|trauma|neuro|burns|respiratory|maternity|pediatric|general>",
  "needsICU": <true | false>,
  "reasoning": "<one or two concise sentences explaining triage justification>"
}`;

    const userPrompt = `Emergency Description: "${description}"
Reported Symptoms: ${symptoms.length > 0 ? symptoms.join(", ") : "None specified"}`;

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Enforce 3-second timeout using Promise.race
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Gemini API triage request timed out (3s threshold)")), 3000);
        });

        const apiCallPromise = ai.models.generateContent({
            model: modelName,
            contents: [
                { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            ],
            config: {
                responseMimeType: "application/json",
            },
        });

        const response = await Promise.race([apiCallPromise, timeoutPromise]);
        const responseText = response.text?.trim() || "";

        // Extract JSON safely
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not parse JSON object from LLM response");
        }

        const parsedRaw = JSON.parse(jsonMatch[0]);

        // Validate and clamp values with Zod
        const validated = TriageOutputSchema.parse({
            category: parsedRaw.category,
            severity: Math.min(5, Math.max(1, Number(parsedRaw.severity) || 3)),
            requiredSpecialty: String(parsedRaw.requiredSpecialty || "general").toLowerCase(),
            needsICU: Boolean(parsedRaw.needsICU),
            reasoning: String(parsedRaw.reasoning || "Triage classification generated by AI model."),
        });

        return {
            ...validated,
            aiSource: "LLM",
        };
    } catch (err) {
        console.warn("⚠️ AI Triage unavailable or timed out; falling back to rule engine:", (err as Error).message);
        return ruleBasedTriage(description, symptoms);
    }
}

