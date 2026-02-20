import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@ApiTags('submission')
@Controller('submission')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new GitHub submission' })
  @ApiBody({ type: CreateSubmissionDto })
  @ApiResponse({
    status: 201,
    description: 'Submission created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error in request body',
  })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissionService.createSubmission(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List submissions' })
  @ApiResponse({ status: 200, description: 'Submissions list' })
  findAll() {
    return this.submissionService.listSubmissions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission by id' })
  @ApiParam({ name: 'id', description: 'Submission id' })
  @ApiResponse({ status: 200, description: 'Submission details' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  findOne(@Param('id') id: string) {
    return this.submissionService.getSubmissionById(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze submission now (manual trigger)' })
  @ApiParam({ name: 'id', description: 'Submission id' })
  @ApiResponse({ status: 201, description: 'Analysis completed and score persisted' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  analyzeNow(@Param('id') id: string) {
    return this.submissionService.analyzeSubmissionNow(id);
  }
}
