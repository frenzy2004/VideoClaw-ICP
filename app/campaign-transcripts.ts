export type TranscriptCue = {
  time: string;
  text: string;
};

export type Transcript = readonly [
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
];

export const baseTranscript: Transcript = [
  { time: '00:00–00:07', text: '[Restrained electronic texture] ONE SHOT · 90 SECONDS Demo Day is one moment.' },
  { time: '00:07–00:16', text: '90 seconds. One room. Then the lights come up.' },
  { time: '00:16–00:25', text: '[Whoosh] But the story does not stop there.' },
  { time: '00:25–00:34', text: 'Your traction. Your team. Your proof.' },
  { time: '00:34–00:41', text: 'Make the founder story keep working.' },
  { time: '00:41–00:45', text: '[Resolving tone] Demo Day is one moment. Keep it working.' },
];

export function transcriptFor(audienceLine: string, highlight: string, emphasis: string): Transcript {
  return [
    baseTranscript[0],
    baseTranscript[1],
    baseTranscript[2],
    { ...baseTranscript[3], text: `${audienceLine} [${highlight} highlighted] ${emphasis}.` },
    baseTranscript[4],
    baseTranscript[5],
  ];
}

export const campaignTranscripts = {
  base: baseTranscript,
  investor: transcriptFor('For the investor who wants to see it after the pitch.', 'Traction', 'Your traction'),
  customer: transcriptFor('For the customer deciding whether to try you.', 'Proof', 'Your proof'),
  recruiting: transcriptFor('For the person you want on the team.', 'Team', 'Your team'),
} satisfies Readonly<Record<string, Transcript>>;
