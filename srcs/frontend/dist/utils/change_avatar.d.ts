declare global {
    interface Window {
        tempAvatarUrl?: string;
        temporaryAvatarFile?: File;
        hasPendingAvatar?: boolean;
    }
}
export declare function saveAvatar(): Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    avatar_url?: string;
}>;
export declare function initAvatarHandlers(): void;
//# sourceMappingURL=change_avatar.d.ts.map