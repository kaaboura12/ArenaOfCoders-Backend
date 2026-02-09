import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'arenaofcoders@gmail.com',
        pass: 'tuil omlu fawc jido',
      },
    });
  }

  async sendVerificationCode(email: string, code: string, firstName: string): Promise<void> {
    const mailOptions = {
      from: 'arenaofcoders@gmail.com',
      to: email,
      subject: 'Verify Your Email - Arena of Coders',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to Arena of Coders!</h2>
          <p>Hi ${firstName},</p>
          <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't create an account with Arena of Coders, please ignore this email.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">Best regards,<br>The Arena of Coders Team</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
