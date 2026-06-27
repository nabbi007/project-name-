import fs from 'fs';
import path from 'path';
import os from 'os';
import { transcribeAudio } from '../src/services/snwolley/speech-to-text.service';
import { AppError } from '../src/utils/AppError';

// Generates a valid 1-second mono 16kHz 16-bit PCM WAV of silence so the STT
// API accepts the format. This verifies live connectivity, auth, and parsing.
function writeSilenceWav(filePath: string): void {
  const sampleRate = 16000;
  const seconds = 1;
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format = PCM
  buffer.writeUInt16LE(1, 22); // channels
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // remaining bytes are zero (silence)

  fs.writeFileSync(filePath, buffer);
}

async function run(): Promise<void> {
  const tmp = path.join(os.tmpdir(), `agrovoice-stt-${Date.now()}.wav`);
  writeSilenceWav(tmp);
  console.log('Generated test WAV:', tmp, fs.statSync(tmp).size, 'bytes');

  try {
    const result = await transcribeAudio(tmp, 'en');
    console.log('LIVE STT SUCCESS');
    console.log('  transcript:', JSON.stringify(result.transcript));
    console.log('  session_id:', result.sessionId);
  } catch (error) {
    if (error instanceof AppError) {
      console.log('LIVE STT returned handled error:');
      console.log('  code:', error.code, '| status:', error.statusCode);
      console.log('  message:', error.message);
      // EMPTY_TRANSCRIPT means the API accepted our request (auth + endpoint OK)
      // but found no speech in the silence - that is a successful connectivity test.
      if (error.code === 'EMPTY_TRANSCRIPT') {
        console.log('=> Connectivity + auth OK (silence produced empty transcript).');
      } else if (error.code === 'STT_AUTH_FAILED') {
        console.log('=> AUTH FAILED: check the team API key.');
      }
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

run();
