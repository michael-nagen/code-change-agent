/**
 * The seed library: a deliberately small, conservative set of real, widely
 * known YouTube videos so /video_today works before any discovery runs. Only
 * links with well-established, stable video ids are seeded; topical videos
 * (Claude Code, Cursor, MCP) arrive via /refresh_videos or the weekly
 * discovery, where a search provider returns current results.
 */
import type { LearningVideo } from './types.js';

const SEED_ADDED_AT = '2026-01-01T00:00:00.000Z';

export function seedVideos(): LearningVideo[] {
  return [
    {
      id: 'seed-1',
      title: 'Intro to Large Language Models',
      youtubeUrl: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
      channelName: 'Andrej Karpathy',
      category: 'other',
      addedAt: SEED_ADDED_AT,
      source: 'seed',
      status: 'available',
    },
    {
      id: 'seed-2',
      title: "Let's build GPT: from scratch, in code, spelled out",
      youtubeUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
      channelName: 'Andrej Karpathy',
      category: 'ai-coding',
      addedAt: SEED_ADDED_AT,
      source: 'seed',
      status: 'available',
    },
    {
      id: 'seed-3',
      title: 'State of GPT',
      youtubeUrl: 'https://www.youtube.com/watch?v=bZQun8Y4L2A',
      channelName: 'Andrej Karpathy (Microsoft Build)',
      category: 'prompting',
      addedAt: SEED_ADDED_AT,
      source: 'seed',
      status: 'available',
    },
    {
      id: 'seed-4',
      title: 'But what is a GPT? Visual intro to transformers',
      youtubeUrl: 'https://www.youtube.com/watch?v=wjZofJX0v4M',
      channelName: '3Blue1Brown',
      category: 'other',
      addedAt: SEED_ADDED_AT,
      source: 'seed',
      status: 'available',
    },
    {
      id: 'seed-5',
      title: 'The spelled-out intro to neural networks and backpropagation',
      youtubeUrl: 'https://www.youtube.com/watch?v=VMj-3S1tku0',
      channelName: 'Andrej Karpathy',
      category: 'ai-coding',
      addedAt: SEED_ADDED_AT,
      source: 'seed',
      status: 'available',
    },
  ];
}
