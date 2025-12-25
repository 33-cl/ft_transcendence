import
{ 
    markSessionActive, 
    markSessionInactive, 
    broadcastSessionCreated, 
    broadcastSessionDestroyed 
} from '../navigation/sessionBroadcast.js';

export interface AuthResponse
{
    success: boolean;
    user?: any;
    error?: string;
    code?: string;
    requires2FA?: boolean;
    message?: string;
}

export async function registerUser(email: string, username: string, password: string): Promise<AuthResponse>
{
    try
    {
        const res = await fetch('/auth/register',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, username, password })
        });

        if (res.status === 201)
        {
            const data = await res.json().catch(() => ({} as any));
            const user = data?.user || null;

            window.currentUser = user;
            markSessionActive();
            broadcastSessionCreated();

            if (window.currentUser && window.reconnectWebSocket)
                window.reconnectWebSocket();

            return { success: true, user };
        }
        else
        {
            const data = await res.json().catch(() => ({} as any));
            return { success: false, error: data?.error || 'Registration error.' };
        }
    }
    catch (e)
    {
        return { success: false, error: 'Cannot reach server.' };
    }
}

export async function loginUser(login: string, password: string, twoFactorCode?: string): Promise<AuthResponse>
{
    try
    {
        const body: any = { login, password };
        if (twoFactorCode)
            body.twoFactorCode = twoFactorCode;
        
        const res = await fetch('/auth/login',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({} as any));

        if (res.ok)
        {
            if (data?.requires2FA)
            {
                return {
                    success: false,
                    requires2FA: true,
                    message: data?.message || 'Two-Factor Authentication required'
                };
            }
            
            const user = data?.user || null;

            window.currentUser = user;
            markSessionActive();
            broadcastSessionCreated();

            if (window.currentUser && window.reconnectWebSocket)
                window.reconnectWebSocket();

            return { success: true, user };
        }
        else
        {
            return {
                success: false,
                error: data?.error || 'Login failed.',
                code: data?.code
            };
        }
    }
    catch (e)
    {
        return { success: false, error: 'Cannot reach server.' };
    }
}

export async function logoutUser(): Promise<void>
{
    try
    {
        await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    }
    catch (e) {}

    window.currentUser = null;
    markSessionInactive();
    broadcastSessionDestroyed();
}
