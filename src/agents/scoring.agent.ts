import { Injectable } from '@nestjs/common';
import { Agent } from './base.agent';
import {
  AntiCheatResult,
  CodeJudgeScore,
  ProductJudgeScore,
  ScoringResult,
} from './agents.types';

export interface ScoringInput {
  codeScore: CodeJudgeScore;
  productScore: ProductJudgeScore;
  antiCheat: AntiCheatResult;
}

@Injectable()
export class ScoringAgent implements Agent<ScoringInput, ScoringResult> {
  async execute(input: ScoringInput): Promise<ScoringResult> {
    const complexityWeighted = input.codeScore.complexity * 0.3;
    const innovationWeighted = input.productScore.innovation * 0.25;
    const impactWeighted = input.productScore.impact * 0.2;
    const qualityWeighted = input.codeScore.codeQuality * 0.25;

    const rawBeforePenalty =
      complexityWeighted + innovationWeighted + impactWeighted + qualityWeighted;
    const final = Math.max(
      0,
      Math.min(100, Number((rawBeforePenalty * 10 - input.antiCheat.penalty).toFixed(2))),
    );

    return {
      finalScore: final,
      breakdown: {
        complexityWeighted,
        innovationWeighted,
        impactWeighted,
        qualityWeighted,
        rawBeforePenalty,
        penalty: input.antiCheat.penalty,
        final,
      },
    };
  }
}
