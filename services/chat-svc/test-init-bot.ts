import { conversationService } from './src/services/conversation.service';
import { logger } from './src/config/logger';

async function test() {
  try {
    const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";
    // Using a fake user id
    const userId = "test-user-id";
    await conversationService.createConversation(
      userId,
      "DIRECT",
      [BOT_USER_ID]
    );
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
