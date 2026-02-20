import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import { OrchestratorAgent } from '../agents/orchestrator.agent';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSubmissionDto } from './dto/create-submission.dto';

const SUBMISSION_SELECT = {
  id: true,
  teamName: true,
  githubUrl: true,
  status: true,
  score: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: OrchestratorAgent,
  ) {}

  async createSubmission(dto: CreateSubmissionDto) {
    const created = await this.prisma.submission.create({
      data: {
        teamName: dto.teamName.trim(),
        githubUrl: dto.githubUrl.trim(),
        status: SubmissionStatus.PENDING,
      },
      select: SUBMISSION_SELECT,
    });

    void this.analyzeInBackground(created.id);
    return created;
  }

  async listSubmissions() {
    return this.prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      select: SUBMISSION_SELECT,
    });
  }

  async getSubmissionById(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: SUBMISSION_SELECT,
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  async analyzeSubmissionNow(id: string) {
    const result = await this.runAnalysis(id);
    if (!result) {
      throw new NotFoundException('Submission not found');
    }
    return result;
  }

  private async analyzeInBackground(id: string) {
    setTimeout(() => {
      void this.runAnalysis(id).catch((error: unknown) => {
        this.logger.error(
          `Background analysis failed for submission ${id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 0);
  }

  private async runAnalysis(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        teamName: true,
        githubUrl: true,
        status: true,
      },
    });

    if (!submission) {
      return null;
    }

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.ANALYZING,
      },
    });

    try {
      const result = await this.orchestrator.execute({
        submissionId: submission.id,
        teamName: submission.teamName,
        githubUrl: submission.githubUrl,
      });

      const updated = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          score: result.finalScore,
          status: SubmissionStatus.DONE,
        },
        select: SUBMISSION_SELECT,
      });

      return {
        submission: updated,
        report: result.report,
        scoring: result.scoring,
        antiCheat: result.antiCheat,
      };
    } catch (error) {
      this.logger.error(
        `Submission analysis failed for ${submission.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.DONE,
          score: 0,
        },
      });
      throw error;
    }
  }
}
