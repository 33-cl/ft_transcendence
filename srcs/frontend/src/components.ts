// Landing page
const landingHTML = `
    <div id="landing-buttons">
        <button id="signInBtn">Sign in</button>
        <button id="guestBtn">Continue as guest</button>
    </div>
`;

// signIn page
const signInHTML = `
    <h2>Sign in</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="password" id="password" placeholder="Password">
    <button id="signIn">SIGN IN</button>

    <p>Don't have an account? <a id="signUpBtn" class="link">Sign up</a></p>
`;

// signUp page
const signUpHTML = `
    <h2>Sign up</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="text" id="age" placeholder="Age">
    <input type="email" id="email" placeholder="Email">
    <input type="password" id="password" placeholder="Password">
    <input type="password" id="confirmPassword" placeholder="Confirm password">
    <button id="signUp">SIGN UP</button>

    <p>Already have an account? <a id="signInBtn" class="link">Sign in</a></p>
`;

// Main menu
const mainMenuHTML = `
    <div class="menu-container">
        <div class="menu-section">
            <h2>Play</h2>
            <div class="button-group">
                <button id="ranked1v1Btn">1v1 Ranked</button>
                <button id="localGameBtn">Local</button>
            </div>
        </div>
        <div class="menu-section">
            <h2>Custom</h2>
            <div class="button-group">
                <button id="customCreateBtn">Create</button>
                <button id="customJoinBtn">Join</button>
            </div>
        </div>
    </div>
`;

// Game
const gameHTML = `
    <canvas id="map" width="850px" height="650px"></canvas>
    <div id="score">
        <span id="leftScore">0</span> -  <span id="rightScore">0</span>
    </div>
    <p id="winnerDisplay"></p>
`;

const loremIpsum = `
    <p>
        The standard Lorem Ipsum passage, used since the 1500s
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

        Section 1.10.32 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
        "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"

        1914 translation by H. Rackham
        "But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?"

        Section 1.10.33 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
        "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat."

        1914 translation by H. Rackham
        "On the other hand, we denounce with righteous indignation and dislike men who are so beguiled and demoralized by the charms of pleasure of the moment, so blinded by desire, that they cannot foresee the pain and trouble that are bound to ensue; and equal blame belongs to those who fail in their duty through weakness of will, which is the same as saying through shrinking from toil and pain. These cases are perfectly simple and easy to distinguish. In a free hour, when our power of choice is untrammelled and when nothing prevents our being able to do what we like best, every pleasure is to be welcomed and every pain avoided. But in certain circumstances and owing to the claims of duty or the obligations of business it will frequently occur that pleasures have to be repudiated and annoyances accepted. The wise man therefore always holds in these matters to this principle of selection: he rejects pleasures to secure other greater pleasures, or else he endures pains to avoid worse pains."
    </p>
`;

// Define all components
const components = {
    landing: {
        id: 'landing',
        html: landingHTML
    },
    mainMenu: {
        id: 'mainMenu',
        html: mainMenuHTML
    },
    game: {
        id: 'game',
        html: gameHTML
    },
    lorem: {
        id: 'lorem-ipsum',
        html: loremIpsum
    },
    signIn: {
        id: 'signIn',
        html: signInHTML
    },
    signUp: {
        id: 'signUp',
        html: signUpHTML
    }
};

// Init components
function show(pageName: keyof typeof components) {
    // Clear all components first
    Object.values(components).forEach(component => {
        const element = document.getElementById(component.id);
        if (element) element.innerHTML = '';
    });

    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        element.innerHTML = component.html;
    }

    // Notifies each element is ready
    setTimeout(() => {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
        // SUPPRESSION : plus d'ajout de listeners multijoueur ici
    }, 0);
}

function hide(pageName: keyof typeof components) {
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) element.innerHTML = '';
}

function hideAllPages(): void {
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

function initializeComponents(): void {
    // Affiche la page d'accueil au chargement
    show('landing');

    // Ajoute la navigation SPA + logique multijoueur dans le même listener
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target && target.id === 'guestBtn') {
            hideAllPages();
            show('mainMenu');
        }
        if (target && target.id === 'localGameBtn') {
            hideAllPages();
            show('game');
        }
        if (target && target.id === 'signInBtn') {
            hideAllPages();
            show('signIn');
        }
        if (target && target.id === 'signUpBtn') {
            hideAllPages();
            show('signUp');
        }
        if (target && target.id === 'title') {
            hideAllPages();
            show('landing');
        }
        // --- SPA room join logic, mais seulement si mainMenu est visible ---
        const mainMenuVisible = document.getElementById('mainMenu')?.innerHTML.includes('1v1 Ranked');
        if (mainMenuVisible) {
            if (target && target.id === 'ranked1v1Btn') {
                (window as any).joinOrCreateRoom(2);
            }
            if (target && target.id === 'customCreateBtn') {
                (window as any).joinOrCreateRoom(4);
            }
            if (target && target.id === 'customJoinBtn') {
                (window as any).joinOrCreateRoom(4);
            }
        }
    });
}

// Init as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
    initializeComponents();
}