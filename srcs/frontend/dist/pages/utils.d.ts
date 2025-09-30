import { leaderboardHTML, friendListHTML, goToProfileHTML, profileHTML, settingsHTML, spectatorGameFinishedHTML } from '../components/index.html.js';
declare const components: {
    landing: {
        id: string;
        html: string;
    };
    mainMenu: {
        id: string;
        html: string;
    };
    goToMain: {
        id: string;
        html: string;
    };
    goToProfile: {
        id: string;
        html: typeof goToProfileHTML;
    };
    leaderboard: {
        id: string;
        html: typeof leaderboardHTML;
    };
    friendList: {
        id: string;
        html: typeof friendListHTML;
    };
    matchmaking: {
        id: string;
        html: string;
    };
    game: {
        id: string;
        html: string;
    };
    game4: {
        id: string;
        html: string;
    };
    signIn: {
        id: string;
        html: string;
    };
    signUp: {
        id: string;
        html: string;
    };
    gameFinished: {
        id: string;
        html: string;
    };
    spectatorGameFinished: {
        id: string;
        html: typeof spectatorGameFinishedHTML;
    };
    profile: {
        id: string;
        html: typeof profileHTML;
    };
    contextMenu: {
        id: string;
        html: string;
    };
    settings: {
        id: string;
        html: typeof settingsHTML;
    };
    aiConfig: {
        id: string;
        html: string;
    };
};
declare function show(pageName: keyof typeof components, data?: any): Promise<void>;
declare function load(pageName: string, data?: any, updateHistory?: boolean): Promise<void>;
declare function hide(pageName: keyof typeof components): void;
declare function hideAllPages(): void;
export { show, load, hideAllPages, hide };
//# sourceMappingURL=utils.d.ts.map