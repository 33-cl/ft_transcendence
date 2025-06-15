// Déclarations globales pour le front TypeScript (non inclus dans le JS final)
declare global
{
	interface Window
	{
		joinOrCreateRoom: (maxPlayers: number) => Promise<void>;
		sendPing: () => void;
		sendMessage: (type: MessageType, data: MessageData) => void;
	}
}
export {};
