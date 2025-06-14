// 3D Environment with Three.js
let scene, camera, renderer;
let contentPlane;
let controls;
let htmlTexture;
let lastRenderTime = 0;
const RENDER_INTERVAL = 1000; // Update HTML texture every second
let isFirstPersonView = false;
let initialCameraPosition = { x: 0, y: 0, z: 5 };
let firstPersonPosition = { x: 0, y: 0, z: -5 };
let debugElement;
let orbitControlsLoaded = false;
let controlsEnabled = true; // Flag to enable/disable controls

// Check WebGL compatibility
function checkWebGLCompatibility() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return {
                compatible: false,
                message: 'WebGL not supported by your browser'
            };
        }
        
        return {
            compatible: true,
            message: 'WebGL supported'
        };
    } catch (e) {
        return {
            compatible: false,
            message: 'Error checking WebGL support: ' + e.message
        };
    }
}

// Check if libraries are loaded
function checkLibraries() {
    debugElement = document.getElementById('debug-info');
    
    if (!debugElement) {
        console.error('Debug element not found');
        return false;
    }
    
    // Check WebGL compatibility first
    const webglStatus = checkWebGLCompatibility();
    let status = 'WebGL: ' + (webglStatus.compatible ? '✅ ' : '❌ ') + webglStatus.message;
    
    if (!webglStatus.compatible) {
        debugElement.innerHTML = status;
        return false;
    }
    
    status += '<br>Checking libraries: ';
    let allLoaded = true;
    
    if (typeof THREE === 'undefined') {
        status += '<br>❌ Three.js not loaded';
        allLoaded = false;
    } else {
        status += '<br>✅ Three.js loaded';
    }
    
    if (typeof TWEEN === 'undefined') {
        status += '<br>❌ Tween.js not loaded';
        allLoaded = false;
    } else {
        status += '<br>✅ Tween.js loaded';
    }
    
    if (typeof html2canvas === 'undefined') {
        status += '<br>❌ html2canvas not loaded';
        allLoaded = false;
    } else {
        status += '<br>✅ html2canvas loaded';
    }
    
    // Check if OrbitControls is available
    if (typeof THREE.OrbitControls === 'undefined') {
        status += '<br>⚠️ OrbitControls not loaded yet';
        orbitControlsLoaded = false;
    } else {
        status += '<br>✅ OrbitControls loaded';
        orbitControlsLoaded = true;
    }
    
    debugElement.innerHTML = status;
    return allLoaded;
}

// Create camera (perspective)
function createCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Position camera directly in front of the screen
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, -10);
    
    console.log('Camera created and positioned');
    if (debugElement) {
        debugElement.innerHTML += '<br>✅ Camera positioned in front of screen';
    }
}

// Setup the 3D scene
function init() {
    console.log('Initializing 3D environment...');
    
    // Initialize debug element
    debugElement = document.getElementById('debug-info');
    if (debugElement) {
        debugElement.innerHTML = 'Checking libraries...';
    }
    
    if (!checkLibraries()) {
        console.error('Required libraries not loaded');
        if (debugElement) {
            debugElement.innerHTML += '<br>⚠️ Some libraries not loaded. Waiting for them...';
        }
        
        // Listen for OrbitControls to be loaded
        document.addEventListener('orbitControlsLoaded', function() {
            console.log('OrbitControls loaded, retrying initialization');
            setTimeout(init, 100); // Retry after a short delay
        });
        return;
    }
    
    try {
        // Make sure the scene container is properly configured
        const sceneContainer = document.getElementById('scene-container');
        if (!sceneContainer) {
            throw new Error('Scene container not found');
        }
        
        // Ensure scene container is visible
        sceneContainer.style.visibility = 'visible';
        sceneContainer.style.opacity = '1';
        
        // Create scene
        scene = new THREE.Scene();
        console.log('Scene created');
        scene.background = new THREE.Color(0x000000);
        if (debugElement) {
            debugElement.innerHTML += '<br>✅ Scene created';
        }
        
        // Create camera with fixed position
        createCamera();
        
        // Create renderer with better settings
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        
        // Clear any existing canvas
        while (sceneContainer.firstChild) {
            sceneContainer.removeChild(sceneContainer.firstChild);
        }
        
        sceneContainer.appendChild(renderer.domElement);
        console.log('Renderer added to DOM');
        if (debugElement) {
            debugElement.innerHTML += '<br>✅ Renderer created';
        }
        
        // Add orbit controls but disable them by default
        try {
            if (typeof THREE.OrbitControls === 'function') {
                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                
                // Disable controls by default for fixed view
                controls.enabled = false;
                controlsEnabled = false;
                
                console.log('Controls created (disabled)');
                if (debugElement) {
                    debugElement.innerHTML += '<br>✅ Controls created (disabled for fixed view)';
                }
            } else {
                setupSimpleControls();
            }
        } catch (error) {
            console.error('Error creating OrbitControls:', error);
            if (debugElement) {
                debugElement.innerHTML += '<br>⚠️ Using simple controls instead';
            }
            setupSimpleControls();
        }
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        
        // Create a grid for orientation
        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);
        
        // Create HTML content plane
        createHTMLContentPlane();
        
        // Add some 3D objects to make the environment more interesting
        addDecorations();
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize);
        
        // Setup view toggle button
        setupViewToggle();
        
        // Setup click handling on the 3D plane
        setupPlaneInteraction();
        
        // Add controls toggle button
        setupControlsToggle();
        
        // Start animation loop
        animate();
        
        // Make sure initial HTML texture is created
        setTimeout(updateHTMLTexture, 500);
        setTimeout(updateHTMLTexture, 1500);
        
        console.log('3D environment initialized successfully');
        if (debugElement) {
            debugElement.innerHTML += '<br>✅ 3D environment initialized successfully';
        }
    } catch (error) {
        console.error('Error initializing 3D environment:', error);
        if (debugElement) {
            debugElement.innerHTML += '<br>❌ Error: ' + error.message;
        }
    }
}

// Setup simple camera controls as a fallback
function setupSimpleControls() {
    // Simple rotation animation
    controls = {
        update: function() {
            if (camera) {
                // Rotate camera around the scene
                const time = Date.now() * 0.0005;
                camera.position.x = Math.sin(time) * 5;
                camera.position.z = Math.cos(time) * 5;
                camera.lookAt(0, 0, -10);
            }
        }
    };
    debugElement.innerHTML += '<br>✅ Simple controls created';
}

// Create a plane to display HTML content
function createHTMLContentPlane() {
    // Create a canvas to render HTML content
    const contentElement = document.getElementById('content-container');
    
    // Calculate aspect ratio based on window dimensions
    const aspectRatio = window.innerWidth / window.innerHeight;
    
    // Calculate plane size to match window dimensions at the given distance
    // Using the camera's field of view to calculate the appropriate size
    const distance = 10; // Distance from camera to plane
    const vFov = THREE.MathUtils.degToRad(75); // Vertical FOV in radians (75 is our camera FOV)
    const planeHeight = 2 * Math.tan(vFov / 2) * distance;
    const planeWidth = planeHeight * aspectRatio;
    
    // Create the plane geometry with the calculated dimensions
    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x202020,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2,
        metalness: 0.3
    });
    
    contentPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    contentPlane.position.set(0, 0, -distance); // Position directly in front of the camera
    scene.add(contentPlane);
    
    console.log(`Content plane created with dimensions: ${planeWidth.toFixed(2)}x${planeHeight.toFixed(2)} at distance ${distance}`);
    
    // Add frame around the content plane
    const frameThickness = 0.2;
    const frameDepth = 0.1;
    
    // Create frame segments for better visual effect
    const frames = [];
    
    // Top frame
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(planeWidth + frameThickness, frameThickness, frameDepth),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.2 })
    );
    topFrame.position.set(0, planeHeight/2 + frameThickness/2, -distance);
    frames.push(topFrame);
    
    // Bottom frame
    const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(planeWidth + frameThickness, frameThickness, frameDepth),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.2 })
    );
    bottomFrame.position.set(0, -planeHeight/2 - frameThickness/2, -distance);
    frames.push(bottomFrame);
    
    // Left frame
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, planeHeight, frameDepth),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.2 })
    );
    leftFrame.position.set(-planeWidth/2 - frameThickness/2, 0, -distance);
    frames.push(leftFrame);
    
    // Right frame
    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, planeHeight, frameDepth),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.2 })
    );
    rightFrame.position.set(planeWidth/2 + frameThickness/2, 0, -distance);
    frames.push(rightFrame);
    
    // Add all frame pieces to the scene
    frames.forEach(frame => scene.add(frame));
    
    // Add a stand or support for the "screen"
    const standHeight = planeHeight * 0.6;
    const standWidth = planeWidth * 0.06;
    const standDepth = 0.5;
    
    const stand = new THREE.Mesh(
        new THREE.BoxGeometry(standWidth, standHeight, standDepth),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.2 })
    );
    stand.position.set(0, -planeHeight/2 - standHeight/2 + 0.2, -distance - 0.3);
    scene.add(stand);
    
    // Add a base for the stand
    const baseWidth = planeWidth * 0.3;
    const baseHeight = 0.2;
    const baseDepth = 1;
    
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.2 })
    );
    base.position.set(0, -planeHeight/2 - standHeight + 0.1, -distance - 0.3);
    scene.add(base);
    
    // Initial HTML texture creation
    updateHTMLTexture();
}

// Setup the view toggle button
function setupViewToggle() {
    const toggleButton = document.getElementById('view-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            toggleFirstPersonView();
        });
    }
}

// Toggle between first-person and normal view
function toggleFirstPersonView() {
    isFirstPersonView = !isFirstPersonView;
    
    const debugInfo = document.getElementById('debug-info');
    const viewToggleBtn = document.getElementById('view-toggle');
    
    if (isFirstPersonView) {
        // Switch to first-person view
        // Move camera to the other side of the plane
        new TWEEN.Tween(camera.position)
            .to({ 
                x: firstPersonPosition.x, 
                y: firstPersonPosition.y, 
                z: firstPersonPosition.z 
            }, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
        
        // Make debug info smaller and transparent
        if (debugInfo) {
            debugInfo.style.opacity = '0.5';
            debugInfo.style.transform = 'scale(0.7)';
        }
        
        // Disable controls temporarily during transition
        if (controls) {
            const wasEnabled = controls.enabled;
            controls.enabled = false;
            setTimeout(() => { 
                // Only re-enable if they were enabled before
                controls.enabled = wasEnabled;
                if (controls.target) {
                    controls.target.set(0, 0, -10); // Look at the plane
                }
            }, 1000);
        }
        
        // Update button text
        if (viewToggleBtn) {
            viewToggleBtn.textContent = 'Exit First-Person View';
            viewToggleBtn.style.backgroundColor = 'rgba(200, 50, 50, 0.8)';
        }
    } else {
        // Switch back to normal view
        new TWEEN.Tween(camera.position)
            .to({ 
                x: 0, 
                y: 0, 
                z: 5 
            }, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
        
        // Restore debug info
        if (debugInfo) {
            debugInfo.style.opacity = '1';
            debugInfo.style.transform = 'scale(1)';
        }
        
        // Disable controls temporarily during transition
        if (controls) {
            const wasEnabled = controls.enabled;
            controls.enabled = false;
            setTimeout(() => { 
                // Only re-enable if they were enabled before
                controls.enabled = wasEnabled;
                if (controls.target) {
                    controls.target.set(0, 0, -10); // Look at the plane
                }
                // Reset camera orientation
                camera.lookAt(0, 0, -10);
            }, 1000);
        }
        
        // Update button text
        if (viewToggleBtn) {
            viewToggleBtn.textContent = 'Toggle First-Person View';
            viewToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        }
    }
    
    // Force HTML texture update immediately and again after transition
    updateHTMLTexture();
    setTimeout(updateHTMLTexture, 1100);
}

// Update the HTML texture using html2canvas
function updateHTMLTexture() {
    const contentElement = document.getElementById('content-container');
    
    if (!contentElement) return;
    
    // Create a clone of the content for capturing
    // This allows us to capture it even when it's hidden
    const contentClone = contentElement.cloneNode(true);
    
    // Create a hidden container for rendering
    let hiddenContainer = document.getElementById('hidden-content');
    if (!hiddenContainer) {
        hiddenContainer = document.createElement('div');
        hiddenContainer.id = 'hidden-content';
        document.body.appendChild(hiddenContainer);
    }
    
    // Clear the hidden container
    while (hiddenContainer.firstChild) {
        hiddenContainer.removeChild(hiddenContainer.firstChild);
    }
    
    // Set styles for proper rendering
    contentClone.style.position = 'static';
    contentClone.style.top = 'auto';
    contentClone.style.left = 'auto';
    contentClone.style.opacity = '1';
    contentClone.style.visibility = 'visible';
    contentClone.style.display = 'flex';
    contentClone.style.pointerEvents = 'none';
    contentClone.style.transform = 'none';
    contentClone.style.width = window.innerWidth + 'px';
    contentClone.style.height = window.innerHeight + 'px';
    contentClone.style.zIndex = 'auto';
    
    // Make sure all elements in the clone are visible
    const allElements = contentClone.querySelectorAll('*');
    allElements.forEach(el => {
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.display = el.tagName === 'DIV' ? 'block' : '';
    });
    
    // Add to hidden container
    hiddenContainer.appendChild(contentClone);
    
    // Use html2canvas to capture the content
    html2canvas(contentClone, {
        backgroundColor: null,
        logging: false,
        useCORS: true,
        scale: 1,
        width: window.innerWidth,
        height: window.innerHeight,
        onclone: function(clonedDoc) {
            // Additional modifications to ensure visibility
            const clonedContent = clonedDoc.getElementById('content-container');
            if (clonedContent) {
                clonedContent.style.display = 'flex';
                clonedContent.style.visibility = 'visible';
                clonedContent.style.opacity = '1';
            }
        }
    }).then(canvas => {
        // Create texture from canvas
        if (htmlTexture) {
            htmlTexture.dispose();
        }
        
        htmlTexture = new THREE.CanvasTexture(canvas);
        htmlTexture.minFilter = THREE.LinearFilter;
        htmlTexture.magFilter = THREE.LinearFilter;
        
        // Update the material of the content plane
        if (contentPlane) {
            contentPlane.material = new THREE.MeshStandardMaterial({
                map: htmlTexture,
                side: THREE.DoubleSide,
                transparent: true
            });
        }
        
        console.log("HTML texture updated successfully");
    }).catch(error => {
        console.error('Error capturing HTML:', error);
    });
}

// Add decorative elements to the 3D environment
function addDecorations() {
    // Add some floating cubes
    for (let i = 0; i < 20; i++) {
        const geometry = new THREE.BoxGeometry(
            Math.random() * 2 + 0.1,
            Math.random() * 2 + 0.1,
            Math.random() * 2 + 0.1
        );
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(Math.random(), Math.random(), Math.random()),
            metalness: 0.3,
            roughness: 0.4
        });
        const cube = new THREE.Mesh(geometry, material);
        
        // Position cubes randomly in the scene, but not too close to the content plane
        cube.position.x = (Math.random() - 0.5) * 30;
        cube.position.y = (Math.random() - 0.5) * 30;
        cube.position.z = (Math.random() - 0.5) * 20 - 15; // Behind the content plane
        
        // Add some rotation
        cube.rotation.x = Math.random() * Math.PI;
        cube.rotation.y = Math.random() * Math.PI;
        
        scene.add(cube);
    }
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update HTML texture when window is resized
    updateHTMLTexture();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update TWEEN
    if (typeof TWEEN !== 'undefined') {
        TWEEN.update();
    }
    
    // Update controls if available
    if (controls) {
        controls.update();
    }
    
    // Rotate content plane slightly for effect
    if (contentPlane) {
        contentPlane.rotation.y = Math.sin(Date.now() * 0.0005) * 0.05;
    }
    
    // Periodically update the HTML texture
    if (renderer && scene && camera) {
        const currentTime = Date.now();
        if (currentTime - lastRenderTime > RENDER_INTERVAL) {
            updateHTMLTexture();
            lastRenderTime = currentTime;
            
            // Check if we're in first-person mode and ensure HTML content is hidden
            ensureFirstPersonModeState();
        }
        
        renderer.render(scene, camera);
    }
}

// Ensure the first-person mode state is correctly applied
function ensureFirstPersonModeState() {
    // Nothing to do here anymore since we've removed the direct HTML display
    // The HTML is always hidden and only rendered on the 3D plane
}

// Listen for SPA navigation events to update the HTML texture
document.addEventListener('componentsReady', function() {
    // Wait a bit for the DOM to update
    setTimeout(updateHTMLTexture, 100);
});

// Initialize when the window loads
window.addEventListener('load', function() {
    // Set a short timeout to ensure DOM is fully loaded
    setTimeout(function() {
        // Initialize 3D environment
        init();
        
        // Force multiple texture updates to ensure content appears on the 3D plane
        setTimeout(updateHTMLTexture, 500);
        setTimeout(updateHTMLTexture, 1500);
        setTimeout(updateHTMLTexture, 3000);
        
        // Add a periodic texture update for SPA navigation
        setInterval(updateHTMLTexture, 2000);
    }, 100);
});

// Setup interaction with the HTML content plane
function setupPlaneInteraction() {
    // Create a raycaster for detecting clicks on the plane
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Get the renderer DOM element
    const rendererElement = renderer.domElement;
    
    // Add click event listener
    rendererElement.addEventListener('click', function(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);
        
        // Calculate objects intersecting the ray
        const intersects = raycaster.intersectObject(contentPlane);
        
        // If the content plane was clicked
        if (intersects.length > 0) {
            const intersect = intersects[0];
            
            // Get UV coordinates of the intersection point
            const uv = intersect.uv;
            
            // Convert UV to pixel coordinates
            const x = Math.floor(uv.x * window.innerWidth);
            const y = Math.floor((1 - uv.y) * window.innerHeight);
            
            console.log(`Clicked on plane at UV: (${uv.x}, ${uv.y}), Pixel: (${x}, ${y})`);
            
            // Find the element at this position in the original content
            simulateClickAtPosition(x, y);
        }
    });
    
    // Add hover effect to show interactive elements
    rendererElement.addEventListener('mousemove', function(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);
        
        // Calculate objects intersecting the ray
        const intersects = raycaster.intersectObject(contentPlane);
        
        // Change cursor style based on whether we're hovering over the plane
        if (intersects.length > 0) {
            rendererElement.style.cursor = 'pointer';
        } else {
            rendererElement.style.cursor = 'default';
        }
    });
}

// Simulate a click at a specific position on the hidden HTML content
function simulateClickAtPosition(x, y) {
    // Get the hidden content element
    const contentElement = document.getElementById('content-container');
    if (!contentElement) return;
    
    // Temporarily make it visible for element detection
    const originalStyles = {
        position: contentElement.style.position,
        top: contentElement.style.top,
        left: contentElement.style.left,
        visibility: contentElement.style.visibility,
        opacity: contentElement.style.opacity,
        display: contentElement.style.display,
        zIndex: contentElement.style.zIndex,
        pointerEvents: contentElement.style.pointerEvents
    };
    
    // Position it at the same coordinates as the visible content
    contentElement.style.position = 'fixed';
    contentElement.style.top = '0';
    contentElement.style.left = '0';
    contentElement.style.visibility = 'visible';
    contentElement.style.opacity = '0.01'; // Nearly invisible but detectable
    contentElement.style.display = 'flex';
    contentElement.style.zIndex = '1000'; // Temporarily bring to front for detection
    contentElement.style.pointerEvents = 'auto';
    
    // Make all child elements have pointer events
    const allElements = contentElement.querySelectorAll('*');
    const originalPointerEvents = [];
    allElements.forEach((el, index) => {
        originalPointerEvents[index] = el.style.pointerEvents;
        el.style.pointerEvents = 'auto';
    });
    
    // Wait a moment for the browser to update
    setTimeout(() => {
        // Find the element at the clicked position
        const element = document.elementFromPoint(x, y);
        
        if (element && element !== document.body && element !== document.documentElement) {
            console.log('Found element:', element);
            
            // Show visual feedback for the click
            const feedbackElement = document.createElement('div');
            feedbackElement.style.position = 'fixed';
            feedbackElement.style.width = '20px';
            feedbackElement.style.height = '20px';
            feedbackElement.style.borderRadius = '50%';
            feedbackElement.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            feedbackElement.style.transform = 'translate(-50%, -50%)';
            feedbackElement.style.left = x + 'px';
            feedbackElement.style.top = y + 'px';
            feedbackElement.style.zIndex = '10000';
            feedbackElement.style.pointerEvents = 'none';
            document.body.appendChild(feedbackElement);
            
            // Animate and remove the feedback element
            setTimeout(() => {
                feedbackElement.style.transition = 'all 0.3s ease';
                feedbackElement.style.opacity = '0';
                feedbackElement.style.transform = 'translate(-50%, -50%) scale(2)';
                setTimeout(() => {
                    document.body.removeChild(feedbackElement);
                }, 300);
            }, 10);
            
            // Simulate a click on the element
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(clickEvent);
            
            // Update the texture after a short delay to reflect any changes
            setTimeout(updateHTMLTexture, 100);
            setTimeout(updateHTMLTexture, 500); // Another update after a longer delay
        }
        
        // Restore original pointer events
        allElements.forEach((el, index) => {
            el.style.pointerEvents = originalPointerEvents[index];
        });
        
        // Restore the original styles
        contentElement.style.position = originalStyles.position;
        contentElement.style.top = originalStyles.top;
        contentElement.style.left = originalStyles.left;
        contentElement.style.visibility = originalStyles.visibility;
        contentElement.style.opacity = originalStyles.opacity;
        contentElement.style.display = originalStyles.display;
        contentElement.style.zIndex = originalStyles.zIndex;
        contentElement.style.pointerEvents = originalStyles.pointerEvents;
    }, 10);
}

// Add a button to toggle controls
function setupControlsToggle() {
    // Create a button element if it doesn't exist
    let controlsToggleBtn = document.getElementById('controls-toggle');
    if (!controlsToggleBtn) {
        controlsToggleBtn = document.createElement('button');
        controlsToggleBtn.id = 'controls-toggle';
        controlsToggleBtn.textContent = 'Enable Camera Controls';
        controlsToggleBtn.style.position = 'fixed';
        controlsToggleBtn.style.bottom = '60px';
        controlsToggleBtn.style.right = '20px';
        controlsToggleBtn.style.zIndex = '1000';
        controlsToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlsToggleBtn.style.color = 'white';
        controlsToggleBtn.style.border = '2px solid white';
        controlsToggleBtn.style.padding = '10px';
        controlsToggleBtn.style.borderRadius = '5px';
        controlsToggleBtn.style.cursor = 'pointer';
        controlsToggleBtn.style.transition = 'all 0.3s ease';
        controlsToggleBtn.style.visibility = 'visible';
        controlsToggleBtn.style.opacity = '1';
        controlsToggleBtn.style.pointerEvents = 'auto';
        
        document.body.appendChild(controlsToggleBtn);
    }
    
    // Add click event listener
    controlsToggleBtn.addEventListener('click', toggleControls);
}

// Toggle camera controls on/off
function toggleControls() {
    if (!controls) return;
    
    controlsEnabled = !controlsEnabled;
    controls.enabled = controlsEnabled;
    
    const controlsToggleBtn = document.getElementById('controls-toggle');
    if (controlsToggleBtn) {
        if (controlsEnabled) {
            controlsToggleBtn.textContent = 'Disable Camera Controls';
            controlsToggleBtn.style.backgroundColor = 'rgba(0, 100, 0, 0.7)';
        } else {
            controlsToggleBtn.textContent = 'Enable Camera Controls';
            controlsToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            
            // Reset camera position when disabling controls
            camera.position.set(0, 0, 5);
            camera.lookAt(0, 0, -10);
        }
    }
    
    if (debugElement) {
        debugElement.innerHTML += `<br>Camera controls ${controlsEnabled ? 'enabled' : 'disabled'}`;
    }
} 