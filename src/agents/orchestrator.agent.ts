import { Injectable } from '@nestjs/common';
import { Agent } from './base.agent';
import { OrchestratorInput, OrchestratorResult } from './agents.types';
import { AntiCheatAgent } from './anti-cheat.agent';
import { CodeJudgeAgent } from './code-judge.agent';
import { CodeSamplerAgent } from './code-sampler.agent';
import {
  EvidenceBuilderAgent,
  EvidenceBuilderInput,
} from './evidence-builder.agent';
import { ProductJudgeAgent } from './product-judge.agent';
import { RepoActivityAgent } from './repo-activity.agent';
import { RepoExtractorAgent } from './repo-extractor.agent';
import { ReportAgent, ReportInput } from './report.agent';
import { ScoringAgent, ScoringInput } from './scoring.agent';
import { StructureAnalysisAgent } from './structure-analysis.agent';

@Injectable()
export class OrchestratorAgent
  implements Agent<OrchestratorInput, OrchestratorResult>
{
  constructor(
    private readonly extractor: RepoExtractorAgent,
    private readonly activity: RepoActivityAgent,
    private readonly structure: StructureAnalysisAgent,
    private readonly sampler: CodeSamplerAgent,
    private readonly evidence: EvidenceBuilderAgent,
    private readonly antiCheat: AntiCheatAgent,
    private readonly codeJudge: CodeJudgeAgent,
    private readonly productJudge: ProductJudgeAgent,
    private readonly scoring: ScoringAgent,
    private readonly report: ReportAgent,
  ) {}

  async evaluateRepo(
    url: string,
    context?: Pick<OrchestratorInput, 'submissionId' | 'teamName'>,
  ): Promise<OrchestratorResult> {
    return this.execute({
      submissionId: context?.submissionId ?? 'n/a',
      teamName: context?.teamName ?? 'Unknown Team',
      githubUrl: url,
    });
  }

  async execute(input: OrchestratorInput): Promise<OrchestratorResult> {
    const repo = await this.extractor.execute(input.githubUrl);
    const activity = await this.activity.execute(repo);
    const structure = await this.structure.execute(repo);
    const samples = await this.sampler.execute(repo);

    const evidenceInput: EvidenceBuilderInput = {
      repo,
      activity,
      structure,
      samples,
    };
    const evidence = await this.evidence.execute(evidenceInput);

    const antiCheat = await this.antiCheat.execute(evidence);
    const codeScore = await this.codeJudge.execute(evidence);
    const productScore = await this.productJudge.execute(evidence);

    const scoringInput: ScoringInput = {
      codeScore,
      productScore,
      antiCheat,
    };
    const scoring = await this.scoring.execute(scoringInput);

    const reportInput: ReportInput = {
      teamName: input.teamName,
      finalScore: scoring.finalScore,
      evidence,
      antiCheatFlags: antiCheat.flags,
    };
    const report = await this.report.execute(reportInput);

    return {
      finalScore: scoring.finalScore,
      evidence,
      antiCheat,
      codeScore,
      productScore,
      scoring,
      report,
    };
  }
}
