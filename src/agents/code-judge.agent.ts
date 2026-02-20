import { Injectable } from '@nestjs/common';
import { Agent } from './base.agent';
import { CodeJudgeScore, Evidence } from './agents.types';
import { GroqAiService } from './groq-ai.service';

@Injectable()
export class CodeJudgeAgent implements Agent<Evidence, CodeJudgeScore> {
  constructor(private readonly groq: GroqAiService) {}

  async execute(evidence: Evidence): Promise<CodeJudgeScore> {
    if (!this.groq.hasApiKey()) {
      return this.fallbackScore(evidence);
    }

    try {
      const result = await this.groq.askForJson<Partial<CodeJudgeScore>>(
        'You are a strict senior software judge. Evaluate only proven evidence. Return JSON only.',
        `Evaluate the technical quality from this evidence:\n${JSON.stringify(evidence)}\n\nReturn JSON with: complexity (0-10), codeQuality (0-10), architecture (0-10), reasoning (string).`,
      );
      return {
        complexity: this.clamp(result.complexity),
        codeQuality: this.clamp(result.codeQuality),
        architecture: this.clamp(result.architecture),
        reasoning: (result.reasoning ?? 'No reasoning provided').slice(0, 1200),
      };
    } catch {
      return this.fallbackScore(evidence);
    }
  }

  private fallbackScore(evidence: Evidence): CodeJudgeScore {
    const complexity = Math.min(10, Math.max(2, Math.floor(evidence.structure.fileCount / 40)));
    const codeQuality = evidence.structure.hasTests ? 7 : 5;
    const architecture = evidence.structure.architectureQuality * 2;
    return {
      complexity,
      codeQuality,
      architecture,
      reasoning: 'Fallback heuristic scoring used because AI provider is unavailable.',
    };
  }

  private clamp(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.round(value)));
  }
}
