import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, Matches, IsUrl } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    example: 'Team Alpha',
    minLength: 2,
    maxLength: 100,
    description: 'Team name for this submission',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  teamName: string;

  @ApiProperty({
    example: 'https://github.com/acme/arena-solution',
    description: 'Public GitHub repository URL',
  })
  @IsString()
  @IsUrl({ require_protocol: true })
  @Matches(/^https?:\/\/(www\.)?github\.com\/.+$/i, {
    message: 'githubUrl must be a valid GitHub repository URL',
  })
  githubUrl: string;
}
