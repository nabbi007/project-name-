import { chatWithAgent } from '../src/services/snwolley/agent-chat.service';
import { parseExtraction } from '../src/modules/listings/listing-extraction.service';

async function main() {
  const prompt = [
    'Extract listing fields from this transcript and respond with ONLY JSON:',
    '{ "crop", "quantity", "unit", "pricePerUnit", "availableDate", "description" }',
    '',
    'CROP: Tomatoes',
    'QUANTITY: Ten baskets',
    'PRICE: 180 cedis per basket',
    'AVAILABLE_DATE: next Friday',
    'DESCRIPTION: Fresh tomatoes from Kumasi.',
  ].join('\n');

  const result = await chatWithAgent(prompt);
  console.log('agent responded:', result.content.length > 0);
  console.log('chat_id:', result.chatId ?? '(none)');
  console.log('preview:', result.content.slice(0, 280));

  const parsed = parseExtraction(result.content);
  if (!parsed) {
    console.log('parse: FAIL (not valid listing JSON)');
    process.exit(1);
  }
  console.log('parse: OK');
  console.log('extracted:', JSON.stringify(parsed.extracted));
  console.log('incomplete:', parsed.incompleteFields.join(', ') || '(none)');
}
main().catch((e) => {
  console.error('FAIL:', e.message ?? e);
  process.exit(1);
});
