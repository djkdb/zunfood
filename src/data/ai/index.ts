import { ENV } from '@/config/env';
import { HttpJudgeProvider } from './HttpJudgeProvider';
import { MockJudgeProvider } from './MockJudgeProvider';
import type { JudgeProvider } from './JudgeProvider';

let instance: JudgeProvider | null = null;

export function getJudgeProvider(): JudgeProvider {
  if (instance) return instance;
  instance =
    ENV.aiJudgeProvider === 'http' && ENV.aiJudgeEndpoint
      ? new HttpJudgeProvider(ENV.aiJudgeEndpoint)
      : new MockJudgeProvider();
  return instance;
}

export type { JudgeProvider, JudgeRequest, JudgeVerdict, JudgeWish } from './JudgeProvider';
