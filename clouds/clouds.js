async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

function makeCloudUniforms() {
    return {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1) },
        iSeed: { value: Math.random() },
        cloudSpeed: { value: 1.0 },
        cloudCover: { value: 0.5 },
        cloudSoftness: { value: 0.18 },
        cloudScale: { value: 1.1 },
        skyZenith: { value: new THREE.Color(0.22, 0.48, 0.82) },
        skyHorizon: { value: new THREE.Color(0.78, 0.90, 0.98) },
        skyDepth: { value: 0.5 },
        cloudBright: { value: new THREE.Color(1.0, 1.0, 1.0) },
        cloudShadow: { value: new THREE.Color(0.82, 0.86, 0.94) },
        sunDir: { value: new THREE.Vector2(0.35, 0.25) },
    };
}

async function init(shaderBasePath = '') {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const vertexShader = await loadShader(shaderBasePath + 'vertex.glsl');
    const fragmentShader = await loadShader(shaderBasePath + 'fragment.glsl');

    const uniforms = makeCloudUniforms();

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        uniforms.iResolution.value.set(width, height, 1);
    });

    const startTime = Date.now();
    function animate() {
        requestAnimationFrame(animate);
        uniforms.iTime.value = (Date.now() - startTime) / 1000.0;
        renderer.render(scene, camera);
    }
    animate();
}

async function initStatic(shaderBasePath = '') {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const vertexShader = await loadShader(shaderBasePath + 'vertex.glsl');
    const fragmentShader = await loadShader(shaderBasePath + 'fragment.glsl');

    const uniforms = makeCloudUniforms();

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer.render(scene, camera);

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        uniforms.iResolution.value.set(width, height, 1);
        renderer.render(scene, camera);
    });
}
