import { conversationService } from './src/services/conversation.service';

async function test() {
  try {
    const res = await conversationService.listConversations("test-user-id");
    console.log("Found conversations:", res.conversations.length);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
