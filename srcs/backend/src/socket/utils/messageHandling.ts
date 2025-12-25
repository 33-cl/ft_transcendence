interface ClientMessage
{
    type: string;
    data?: {
        player?: string;
        direction?: string;
    };
}

// Parse JSON message from client safely
export function parseClientMessage(msg: string): ClientMessage | null
{
    try
    {
        return JSON.parse(msg);
    }
    catch (e)
    {
        return null;
    }
}

// Check if message is keyboard event (keydown/keyup)
export function isKeyboardEvent(message: ClientMessage | null): boolean
{
    return message?.type === 'keydown' || message?.type === 'keyup';
}
