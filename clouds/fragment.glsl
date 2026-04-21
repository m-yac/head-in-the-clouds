uniform vec3 iResolution;
uniform float iTime;
uniform float iSeed;
uniform float cloudSpeed;
uniform float cloudCover;
uniform float cloudSoftness;
uniform float cloudScale;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform float skyDepth;
uniform vec3 cloudBright;
uniform vec3 cloudShadow;
uniform vec2 sunDir;

varying vec2 vUv;

#define PI 3.14159265359

// --- Hash / value noise ---
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) {
        v += amp * vnoise(p);
        p = rot * p * 2.03;
        amp *= 0.5;
    }
    return v;
}

// Sample cloud density on the layer. Returns 0..1 density.
float cloudField(vec2 p, float cover) {
    // Light domain warp — just enough to break up straight fbm contours
    // without making the shapes feel wiggly.
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0)),
                  fbm(p + vec2(5.2, 1.3)));
    float n = fbm(p + 1.2 * q);

    // Shape: subtract cover threshold; clouds appear where n > threshold.
    float thresh = 1.0 - cover;
    float edge = cloudSoftness;
    float d = smoothstep(thresh, thresh + edge, n);
    // Power curve inflates the body of each puff while keeping soft edges.
    return pow(d, 0.7);
}

void main() {
    // Centered UV, aspect-corrected.
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float t = iTime * cloudSpeed + iSeed * 1000.0;

    // Sky gradient (zenith -> horizon).
    float skyY = clamp(uv.y * 0.6 + 0.55, 0.0, 1.0);
    vec3 sky = mix(skyHorizon, skyZenith, pow(skyY, 1.3));
    // skyDepth darkens the sky toward a saturated blue (keeps B, cuts R/G).
    sky *= mix(vec3(1.0), vec3(0.35, 0.5, 0.9), clamp(skyDepth, 0.0, 1.0));

    // Subtle sun glow near horizon.
    vec2 sunPos = vec2(sunDir.x * 0.6, sunDir.y * 0.4);
    float sunGlow = exp(-length(uv - sunPos) * 1.8);
    sky += vec3(0.15, 0.10, 0.05) * sunGlow * 0.6;

    // Project screen uv onto a cloud plane above the camera.
    // angle: 0 = horizon, pi/2 = zenith. Bias so the frame sits upward.
    // The clamp region (uv.y < ~-0.34) is hidden by horizonFade below.
    float angle = clamp(uv.y * 0.9 + 0.35, 0.04, 1.5);
    float s = sin(angle);
    // x scales by 1/sin (perspective widening toward horizon); y uses
    // cotangent so it stays monotonically varying all the way to the zenith.
    float xScale = 1.0 / s;
    float yGround = cos(angle) / s;

    vec2 windDrift = vec2(t * 0.04, t * 0.008);
    vec2 cp = vec2(uv.x * xScale, yGround) * cloudScale + windDrift;

    // Two layers at different heights/scales for depth.
    float d1 = cloudField(cp, cloudCover);
    float d2 = cloudField(cp * 1.7 + vec2(13.2, -7.4), cloudCover * 0.85);

    float density = max(d1, d2 * 0.75);

    // Fake volumetric lighting: compare density with a sample offset
    // toward the sun direction. More "interior" pixels get shaded darker,
    // edges facing the sun glow bright.
    vec2 lightOff = sunDir * 0.06;
    float dLit = cloudField(cp + lightOff, cloudCover);
    float lightTerm = clamp((dLit - density) * 1.5 + 0.55, 0.0, 1.0);

    vec3 cloudCol = mix(cloudShadow, cloudBright, lightTerm);

    // Soft rim brighten where density is thin and lit.
    float rim = smoothstep(0.0, 0.4, density) * (1.0 - density);
    cloudCol += vec3(0.08, 0.07, 0.05) * rim * lightTerm;

    // Horizon haze: clouds fade into atmosphere near horizon. Pulled up
    // high enough to hide any residual stretch in the clamped angle region.
    float horizonFade = smoothstep(-0.3, 0.0, uv.y);
    density *= horizonFade;

    vec3 col = mix(sky, cloudCol, density);

    // Gentle vignette to settle the image.
    float vig = 1.0 - 0.15 * dot(uv, uv);
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
}
