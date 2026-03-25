import { Command } from '../cli/command.js';
import chalk from 'chalk';
import { platform, release, arch } from 'os';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getEmailJsConfig() {
  return {
    serviceId: process.env.EMAILJS_SERVICE_ID,
    templateId: process.env.EMAILJS_TEMPLATE_ID,
    userId: process.env.EMAILJS_USER_ID,
    accessToken: process.env.EMAILJS_ACCESS_TOKEN,
  };
}

class SendFeedbackCommand extends Command {
  name = 'send-feedback <message...>';
  description = 'Send feedback directly to the CLI maintainer';
  needsConnection = false;

  async execute(ctx, options, ...messageParts) {
    const message = messageParts.join(' ');

    if (!message) {
      process.exitCode = 1;
      ctx.logError('Usage: figma-gemini-cli send-feedback "Your feedback here"', {
        success: false,
        error: 'Feedback message is required.',
      });
      return;
    }

    // Collect metadata
    let version = 'unknown';
    try {
      const pkgPath = join(__dirname, '..', '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      version = pkg.version;
    } catch {}

    const metadata = {
      message,
      version,
      platform: platform(),
      os_release: release(),
      arch: arch(),
      timestamp: new Date().toISOString(),
      maintainer_email: 'abdelrahman.arab.ac@gmail.com'
    };

    const spinner = ctx.startSpinner('Sending feedback...');
    if (!ctx.isJson) {
      console.log(chalk.blue('\n  [OK] Preparing feedback...'));
      console.log(chalk.gray(`  Version:   ${metadata.version}`));
      console.log(chalk.gray(`  Platform:  ${metadata.platform} (${metadata.os_release})`));
    }
    
    // Simulate sending (Option B approach)
    // In a real production scenario, you would use a service like Formspree, 
    // a small AWS Lambda/Vercel function, or an internal feedback API.
    
    try {
      const emailJsConfig = getEmailJsConfig();
      const missingConfig = Object.entries(emailJsConfig)
        .filter(([, value]) => !value)
        .map(([key]) => key);

      if (missingConfig.length > 0) {
        throw new Error(`Feedback delivery is not configured in this environment. Missing: ${missingConfig.join(', ')}`);
      }

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: emailJsConfig.serviceId,
          template_id: emailJsConfig.templateId,
          user_id: emailJsConfig.userId,
          accessToken: emailJsConfig.accessToken,
          template_params: {
            message: metadata.message,
            version: metadata.version,
            platform: metadata.platform,
            os_release: metadata.os_release,
            arch: metadata.arch,
            timestamp: metadata.timestamp,
            maintainer_email: metadata.maintainer_email
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server responded with ${response.status}`);
      }

      const payload = {
        success: true,
        message,
        version: metadata.version,
        platform: metadata.platform,
        os_release: metadata.os_release,
        arch: metadata.arch,
        timestamp: metadata.timestamp,
        maintainer_email: metadata.maintainer_email,
        delivery: 'emailjs',
      };

      if (ctx.isJson) {
        ctx.logSuccess('Feedback sent successfully.', payload);
      } else {
        spinner.succeed('Feedback sent successfully.');
        console.log(chalk.white(`    Thank you for helping improve Figma CLI. The maintainer will receive your message at: ${chalk.cyan(metadata.maintainer_email)}`));
        console.log();
      }

    } catch (err) {
      process.exitCode = 1;
      const payload = {
        success: false,
        message,
        version: metadata.version,
        platform: metadata.platform,
        os_release: metadata.os_release,
        arch: metadata.arch,
        timestamp: metadata.timestamp,
        maintainer_email: metadata.maintainer_email,
        error: err.message,
        fallback: `mailto:${metadata.maintainer_email}`,
      };

      if (ctx.isJson) {
        ctx.logError(`Failed to send feedback: ${err.message}`, payload);
      } else {
        spinner.fail(`Failed to send feedback: ${err.message}`);
        console.log(chalk.gray('\n  You can also email your feedback directly to:'));
        console.log(chalk.cyan(`  ${metadata.maintainer_email}`));
      }
    }
  }
}

export default [new SendFeedbackCommand()];
