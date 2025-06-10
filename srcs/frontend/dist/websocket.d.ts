declare var io: any;
declare const socket: any;
declare function sendPing(): void;
type MessageType = 'move' | 'score' | string;
interface MessageData {
    [key: string]: any;
}
declare function sendMessage(type: MessageType, data: MessageData): void;
declare function handleWebSocketMessage(message: {
    type: MessageType;
    data: MessageData;
}): void;
declare let currentRoom: string | null;
declare let joinInProgress: boolean;
declare let lastJoinPromise: Promise<void> | null;
declare function joinOrCreateRoom(maxPlayers: number): Promise<void>;
//# sourceMappingURL=websocket.d.ts.map