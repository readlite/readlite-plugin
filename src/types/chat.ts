export interface ChatMessage {
  message: string;
  sender: string;
  direction: "incoming" | "outgoing";
  sentTime: string;
  id: string;
}
