import { z } from "zod";

export const stageNameSchema = z.enum([
  "opening",
  "discovery",
  "qualification",
  "solution_framing",
  "objection_handling",
  "closing",
  "next_steps",
]);

export const signalTypeSchema = z.enum([
  "buying_signal",
  "risk_signal",
  "missing_info",
  "competitor",
  "urgency",
  "budget",
  "objection",
]);

export const recommendationTypeSchema = z.enum([
  "question",
  "argument",
  "warning",
  "next_step",
  "objection_response",
]);

export const prioritySchema = z.enum(["low", "medium", "high"]);

export const liveAnalysisResponseSchema = z.object({
  stage: stageNameSchema,
  reason: z.string().optional(),
  detectedSignals: z
    .array(
      z.object({
        type: signalTypeSchema,
        label: z.string(),
        confidence: z.number().min(0).max(1),
        evidence: z.string(),
      }),
    )
    .default([]),
  knownFields: z.record(z.string(), z.string().nullable()).default({}),
  missingFields: z.array(z.string()).default([]),
  recommendation: z
    .object({
      type: recommendationTypeSchema,
      title: z.string(),
      message: z.string(),
      suggestedPhrase: z.string().optional().nullable(),
      priority: prioritySchema,
      reason: z.string(),
    })
    .nullable()
    .optional(),
});

export type LiveAnalysisResponse = z.infer<typeof liveAnalysisResponseSchema>;

export const postCallSummarySchema = z.object({
  executiveSummary: z.string(),
  painPoints: z.array(z.string()),
  objections: z.array(z.string()),
  buyingSignals: z.array(z.string()),
  risks: z.array(z.string()),
  missingFields: z.array(z.string()),
  nextSteps: z.array(z.string()),
  suggestedEmail: z.string(),
  score: z.object({
    overallScore: z.number(),
    discoveryScore: z.number(),
    qualificationScore: z.number(),
    objectionScore: z.number(),
    closingScore: z.number(),
    methodologyAdherence: z.number(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
  }),
});

export type PostCallSummary = z.infer<typeof postCallSummarySchema>;
