import React from "react";
import ConversationListScreen from "../../screens/chats/ConversationListScreen";

// Shows only 1:1 direct message conversations in the Community Chats tab.
const ChatsTab = () => <ConversationListScreen isTab directOnly />;

export default ChatsTab;
