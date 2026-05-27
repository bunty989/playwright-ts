import fs from 'fs';
import path from 'path';
import { LocatorType } from '../support/testConstant';
import { Log } from '../support/logger';
import { SelfHealingLocator } from './aiLocatorHelper';

interface SelfHealingAuditEntry {
  timestampUtc: string;
  status: 'PendingReview';
  elementDescription: string;
  pageUrl?: string;
  pageTitle?: string;
  isCollection: boolean;
  originalLocator: {
    locatorType: LocatorType;
    locatorInfo: string;
  };
  healedLocator: {
    locatorType: LocatorType;
    locatorInfo: string;
    confidence: number;
    reason?: string;
  };
  healedElementCount: number;
}

export class SelfHealingAudit {
  private static auditFilePath = path.join(
    process.cwd(),
    'logs',
    'SelfHealedLocators.jsonl'
  );

  static initialise(reportFolderPath: string): void {
    SelfHealingAudit.auditFilePath = path.join(
      reportFolderPath,
      'SelfHealedLocators.jsonl'
    );
  }

  static recordSuccessfulHeal(
    elementDescription: string,
    originalLocatorType: LocatorType,
    originalLocatorInfo: string,
    healedLocator: SelfHealingLocator,
    pageUrl: string | undefined,
    pageTitle: string | undefined,
    isCollection: boolean,
    healedElementCount: number
  ): void {
    try {
      fs.mkdirSync(path.dirname(SelfHealingAudit.auditFilePath), {
        recursive: true,
      });

      const entry: SelfHealingAuditEntry = {
        timestampUtc: new Date().toISOString(),
        status: 'PendingReview',
        elementDescription,
        pageUrl,
        pageTitle,
        isCollection,
        originalLocator: {
          locatorType: originalLocatorType,
          locatorInfo: originalLocatorInfo,
        },
        healedLocator: {
          locatorType: healedLocator.locatorType,
          locatorInfo: healedLocator.locator,
          confidence: healedLocator.confidence,
          reason: healedLocator.reason,
        },
        healedElementCount,
      };

      fs.appendFileSync(
        SelfHealingAudit.auditFilePath,
        `${JSON.stringify(entry)}\n`,
        'utf8'
      );

      Log.info('Self-healed locator written for review', {
        path: SelfHealingAudit.auditFilePath,
      });
    } catch (err) {
      Log.error('Unable to write self-healed locator audit record', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
