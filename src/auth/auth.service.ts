import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { CvExtractionService } from '../cv-extraction/cv-extraction.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { AuthTokens, AuthUser, JwtPayload } from './auth.types';
import { UserRole, Specialty } from '@prisma/client';
import type { UpdateProfileDto } from '../user/dto/update-profile.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly cvExtractionService: CvExtractionService,
  ) {
    this.jwtExpiresIn =
      this.config.get<string>('JWT_EXPIRES_IN', '7d');
  }

  async signUp(
    dto: SignUpDto,
    resumeBuffer: Buffer,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.userService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: UserRole.USER,
    });

    if (resumeBuffer?.length) {
      const extraction = await this.cvExtractionService.extractFromBuffer(resumeBuffer);
      const updateDto: UpdateProfileDto = {};
      if (extraction.mainSpecialty != null) updateDto.mainSpecialty = extraction.mainSpecialty as Specialty;
      if (extraction.skillTags.length > 0) updateDto.skillTags = extraction.skillTags;
      if (Object.keys(updateDto).length > 0) {
        await this.userService.updateProfile(user.id, updateDto);
      }
    }

    await this.emailVerificationService.sendVerificationCode(
      user.email,
      user.firstName,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = this.issueTokens(payload);
    const finalUser = await this.userService.findById(user.id);
    return {
      user: this.toAuthUser(finalUser ?? user),
      tokens,
    };
  }

  async signIn(dto: SignInDto): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBanned) {
      throw new BadRequestException('Account is banned');
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = this.issueTokens(payload);
    return {
      user: this.toAuthUser(user),
      tokens,
    };
  }

  async validateUserById(id: string) {
    return this.userService.findById(id);
  }

  private issueTokens(payload: JwtPayload): AuthTokens {
    const expiresInSeconds = this.parseExpiresInToSeconds(this.jwtExpiresIn);
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresInSeconds,
    });
    return { accessToken, expiresIn: expiresInSeconds };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // default 7 days in seconds
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 86400);
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    await this.emailVerificationService.verifyCode(email, code);
  }

  async resendVerificationCode(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    await this.emailVerificationService.sendVerificationCode(
      user.email,
      user.firstName,
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  /**
   * Upload resume (.docx), run CV extraction via Hugging Face, then update user's mainSpecialty and skillTags.
   */
  async uploadCvAndUpdateProfile(
    userId: string,
    buffer: Buffer,
  ) {
    const extraction = await this.cvExtractionService.extractFromBuffer(buffer);
    const dto: UpdateProfileDto = {};
    if (extraction.mainSpecialty != null) dto.mainSpecialty = extraction.mainSpecialty as Specialty;
    if (extraction.skillTags.length > 0) dto.skillTags = extraction.skillTags;
    return this.userService.updateProfile(userId, dto);
  }
}
