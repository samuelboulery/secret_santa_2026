// Scène 3D minimaliste : fond très sombre + gramophone FBX au centre.
// Clic sur le gramophone = lecture / pause de la musique.
// Rotation de la vue au drag (OrbitControls), pas de rotation automatique de l’objet.

import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("scene");
const audioEl = document.getElementById("gramophone-audio");

/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {OrbitControls} */
let controls;
/** @type {THREE.Group | null} */
let gramophone = null;
/** @type {THREE.Mesh | null} */
let playButton3D = null;
/** @type {THREE.Sprite | null} */
let countdownSprite = null;
/** @type {THREE.PointLight | null} */
let countdownLight = null;
let clock;
let isPlaying = false;
let audioContext = null;
let audioSource = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050307);
  scene.fog = new THREE.Fog(0x050307, 6, 20);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 50);
  // Position initiale pour le cadrage par défaut : vue de face avec le compteur visible derrière (un peu plus dézoomé)
  camera.position.set(0.3, 1.2, 5.5);
  camera.lookAt(0, 0.9, 0);

  // Lumière ambiante faible mais un peu plus présente
  const ambient = new THREE.AmbientLight(0x0b0b12, 0.3);
  scene.add(ambient);

  // Spot principal qui éclaire le gramophone (effet scène / projecteur élargi)
  const keyLight = new THREE.SpotLight(
    0xffe0b2,
    18.0,
    30,
    Math.PI / 3.2,
    0.35,
    1.3
  );
  keyLight.position.set(1.6, 3.2, 2.0);
  keyLight.target.position.set(0, 0.8, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  scene.add(keyLight.target);

  // Lumière de remplissage froide pour déboucher les ombres
  const fillLight = new THREE.PointLight(0x4f46e5, 0.8, 14);
  fillLight.position.set(-2.5, 2.0, 3.2);
  scene.add(fillLight);

  // Spot léger face au gramophone (depuis l'avant)
  const frontSpot = new THREE.SpotLight(
    0xfff4e6,
    3.0,
    12,
    Math.PI / 5,
    0.4,
    1.2
  );
  frontSpot.position.set(0, 1.5, 4.5); // Devant le gramophone, légèrement au-dessus
  frontSpot.target.position.set(0, 0.8, 0); // Cible le gramophone
  frontSpot.castShadow = false; // Pas d'ombre pour ce spot léger
  scene.add(frontSpot);
  scene.add(frontSpot.target);

  // Sol discret pour recevoir les ombres (sans cercle lumineux)
  const floorGeo = new THREE.CircleGeometry(4, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x050308,
    roughness: 1.0,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // Bouton 3D rectangle arrondi au sol avec texte "play/pause"
  // Création d'une texture canvas avec le texte et coins arrondis
  const buttonCanvas = document.createElement("canvas");
  buttonCanvas.width = 512;
  buttonCanvas.height = 256;
  const ctx = buttonCanvas.getContext("2d");
  
  // Rectangle avec coins arrondis
  const cornerRadius = 30;
  const width = 512;
  const height = 256;
  
  ctx.beginPath();
  ctx.moveTo(cornerRadius, 0);
  ctx.lineTo(width - cornerRadius, 0);
  ctx.quadraticCurveTo(width, 0, width, cornerRadius);
  ctx.lineTo(width, height - cornerRadius);
  ctx.quadraticCurveTo(width, height, width - cornerRadius, height);
  ctx.lineTo(cornerRadius, height);
  ctx.quadraticCurveTo(0, height, 0, height - cornerRadius);
  ctx.lineTo(0, cornerRadius);
  ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
  ctx.closePath();
  
  // Fond gris très foncé
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  
  // Texte "play/pause" en blanc pour contraster
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("play", width / 2, height / 2 - 30);
  ctx.fillText("pause", width / 2, height / 2 + 30);
  
  // S'assurer que le canvas est bien rendu
  ctx.save();
  
  const buttonTexture = new THREE.CanvasTexture(buttonCanvas);
  buttonTexture.colorSpace = THREE.SRGBColorSpace;
  buttonTexture.needsUpdate = true; // S'assurer que la texture est mise à jour
  
  // Matériau pour la face supérieure (avec texture)
  const topMat = new THREE.MeshStandardMaterial({
    map: buttonTexture,
    color: 0xffffff, // Couleur de base blanche pour que la texture soit visible
    emissive: 0x1a1a1a,
    emissiveIntensity: 0.1,
    roughness: 0.7,
    metalness: 0.1,
  });
  
  // Matériau pour les autres faces (sans texture, gris foncé)
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    emissive: 0x1a1a1a,
    emissiveIntensity: 0.1,
    roughness: 0.7,
    metalness: 0.1,
  });
  
  // Surface texturée épaissie (BoxGeometry avec matériaux différents par face)
  // BoxGeometry: width (X), height (Y), depth (Z)
  // BoxGeometry(1.2, 0.6, 0.08) :
  // - Faces avant/arrière (+Z/-Z) : 1.2 x 0.6 (LA PLUS GRANDE - surface horizontale)
  // - Faces haut/bas (+Y/-Y) : 1.2 x 0.08 (tranches)
  // - Faces droite/gauche (+X/-X) : 0.6 x 0.08 (tranches)
  // Ordre des faces: droite (+X), gauche (-X), haut (+Y), bas (-Y), avant (+Z), arrière (-Z)
  // Après rotation X = -90°, la face "avant" (+Z) devient la face supérieure horizontale
  const buttonGeo = new THREE.BoxGeometry(1.2, 0.6, 0.08);
  const materials = [
    sideMat, // droite (+X) - tranche fine (0.6 x 0.08)
    sideMat, // gauche (-X) - tranche fine (0.6 x 0.08)
    sideMat, // haut (+Y) - tranche fine (1.2 x 0.08)
    sideMat, // bas (-Y) - tranche fine (1.2 x 0.08)
    topMat,  // avant (+Z) - avec texture (1.2 x 0.6 - LA PLUS GRANDE, devient la face supérieure après rotation)
    sideMat, // arrière (-Z) - tranche fine (1.2 x 0.6 mais on ne la voit pas)
  ];
  
  playButton3D = new THREE.Mesh(buttonGeo, materials);
  playButton3D.position.set(0.4, 0.04, 1.1);
  playButton3D.rotation.x = -Math.PI / 2; // À plat sur le sol
  playButton3D.castShadow = true;
  playButton3D.receiveShadow = true;
  scene.add(playButton3D);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  resizeRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Contrôles de caméra : drag pour tourner autour du gramophone
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 7;
  controls.target.set(0, 0.9, 0);
  controls.update();

  clock = new THREE.Clock();

  loadGramophone();
  setupInteraction();
  setupAudioListeners();
  createCountdown();
  animate();
}

function resizeRenderer() {
  if (!renderer || !camera) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
}

function loadGramophone() {
  const loader = new FBXLoader();

  // Textures PBR (maps exportées en .tga.png)
  const texLoader = new THREE.TextureLoader();
  const baseColor = texLoader.load("assets/DefaultMaterial_Base_color.tga.png");
  const metalnessMap = texLoader.load("assets/DefaultMaterial_Metallic.tga.png");
  const roughnessMap = texLoader.load("assets/DefaultMaterial_Roughness.tga.png");
  const normalMap = texLoader.load(
    "assets/DefaultMaterial_Normal_OpenGL.tga.png"
  );
  const aoMap = texLoader.load("assets/DefaultMaterial_Mixed_AO.tga.png");

  // Espace couleur correct pour les textures de couleur / AO
  baseColor.colorSpace = THREE.SRGBColorSpace;
  aoMap.colorSpace = THREE.SRGBColorSpace;

  const pbrMaterial = new THREE.MeshStandardMaterial({
    map: baseColor,
    metalnessMap,
    roughnessMap,
    normalMap,
    aoMap,
    metalness: 1.0,
    roughness: 1.0,
  });

  // Place ton modèle dans /Users/sam/secret_santa_2026/assets/gramophone.fbx
  loader.load(
    "assets/gramophone.fbx",
    (object) => {
      gramophone = object;

      console.log("FBX gramophone chargé :", gramophone);

      // Applique le matériau PBR texturé à tous les meshes du modèle
      gramophone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = pbrMaterial;
        }
      });

      // Boîte englobante AVANT transformation (juste pour connaître les dimensions)
      const initialBox = new THREE.Box3().setFromObject(gramophone);
      const initialSize = initialBox.getSize(new THREE.Vector3());

      console.log("Boîte englobante FBX size=", initialSize);

      // 1) Échelle : on garde le centre comme il est, on réduit/agrandit simplement
      const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z);
      const desired = 2.0; // taille cible dans la scène
      const scale = maxDim > 0 ? desired / maxDim : 1;
      gramophone.scale.setScalar(scale);

      // 2) On recentre grosso modo en X/Z autour de 0
      gramophone.position.set(0, 0, 0);

      // 3) On recalcule la boîte APRES scale pour connaître la hauteur finale
      const box = new THREE.Box3().setFromObject(gramophone);
      const size = box.getSize(new THREE.Vector3());
      const min = box.min.clone();

      // On remonte le modèle pour que le bas repose exactement sur y=0
      gramophone.position.y -= min.y;

      console.log(
        "Boîte après scale size=",
        size,
        "min=",
        min,
        "pos finale=",
        gramophone.position
      );

      // Légère rotation de 3/4 pour un rendu plus cinématographique
      gramophone.rotation.y = -Math.PI / 5;

      scene.add(gramophone);
    },
    undefined,
    (error) => {
      console.error("Erreur de chargement du FBX du gramophone :", error);
    }
  );
}

function setupInteraction() {
  window.addEventListener("resize", resizeRenderer);

  let isProcessing = false; // Évite les doubles clics rapides

  const handlePointer = (clientX, clientY) => {
    if (!scene || !camera || !playButton3D || isProcessing) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);

    // Le clic sert maintenant à activer le bouton 3D au sol
    const intersects = raycaster.intersectObject(playButton3D, true);
    if (intersects.length > 0) {
      isProcessing = true;
      toggleGramophone();
      // Réinitialise après un court délai pour éviter les doubles déclenchements
      setTimeout(() => {
        isProcessing = false;
      }, 300);
    }
  };

  canvas.addEventListener("click", (event) => {
    event.preventDefault();
    handlePointer(event.clientX, event.clientY);
  });

  // Gestion améliorée des événements tactiles
  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      if (!touch) return;
      handlePointer(touch.clientX, touch.clientY);
    },
    { passive: false }
  );
}

function setupAudioListeners() {
  if (!audioEl) return;

  // Synchronise l'état isPlaying avec les événements audio
  audioEl.addEventListener("play", () => {
    isPlaying = true;
  });

  audioEl.addEventListener("pause", () => {
    isPlaying = false;
  });

  audioEl.addEventListener("ended", () => {
    isPlaying = false;
  });
}

function getDaysUntilTarget() {
  const targetDate = new Date("2026-02-06T00:00:00");
  const now = new Date();
  const diffTime = targetDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

let decortFontLoaded = false;

async function loadDecortFont() {
  if (decortFontLoaded) return;
  
  try {
    const font = new FontFace("Decort", `url(assets/Decort.ttf)`);
    await font.load();
    document.fonts.add(font);
    decortFontLoaded = true;
  } catch (error) {
    console.error("Erreur lors du chargement de la police Decort:", error);
  }
}

function createCountdownTexture(text) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  // Résolution adaptée au pixel ratio pour éviter le flou sur mobile
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const baseWidth = 1024;
  const baseHeight = 512;
  
  canvas.width = baseWidth * pixelRatio;
  canvas.height = baseHeight * pixelRatio;
  
  // Mise à l'échelle du contexte pour la haute résolution
  context.scale(pixelRatio, pixelRatio);
  
  // Fond transparent
  context.clearRect(0, 0, baseWidth, baseHeight);
  
  const centerX = baseWidth / 2;
  const centerY = baseHeight / 2;
  
  // Taille de police adaptée
  const fontSize = 300;
  context.font = `bold ${fontSize}px Decort, Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  
  // Effet de halo optimisé - moins de passes mais mieux géré
  // Passe 1 : Halo externe (couleur chaude/orange) - flou modéré
  context.shadowColor = "rgba(255, 180, 80, 0.7)";
  context.shadowBlur = 30;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = "rgba(255, 200, 100, 0.5)";
  context.fillText(text, centerX, centerY);
  
  // Passe 2 : Halo moyen (blanc chaud) - flou moyen
  context.shadowColor = "rgba(255, 240, 200, 0.6)";
  context.shadowBlur = 20;
  context.fillStyle = "rgba(255, 255, 200, 0.7)";
  context.fillText(text, centerX, centerY);
  
  // Passe 3 : Halo interne (blanc lumineux) - flou léger
  context.shadowColor = "rgba(255, 255, 255, 0.8)";
  context.shadowBlur = 12;
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.fillText(text, centerX, centerY);
  
  // Texte principal solide (blanc pur) - pas d'ombre pour netteté
  context.shadowBlur = 0;
  context.fillStyle = "#ffffff";
  context.fillText(text, centerX, centerY);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function createCountdown() {
  // Charge la police Decort avant de créer le compteur
  await loadDecortFont();
  
  const days = getDaysUntilTarget();
  const text = `${days}`;
  
  const texture = createCountdownTexture(text);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    // Effet d'émission pour créer un halo lumineux dans la scène
    emissive: 0xffc864,
    emissiveIntensity: 1.5,
  });
  
  countdownSprite = new THREE.Sprite(spriteMaterial);
  
  // Position : derrière le gramophone, un peu plus bas
  // Le gramophone est à y ≈ 0.9, on met le compteur un peu plus haut (y ≈ 2.0)
  // et derrière (z négatif, environ -2)
  const countdownPosition = new THREE.Vector3(0, 2.0, -2);
  countdownSprite.position.copy(countdownPosition);
  
  // Taille du sprite (ratio 2:1 pour correspondre au canvas et éviter la déformation)
  // Canvas: 1024x512 = ratio 2:1, donc scale doit respecter ce ratio
  countdownSprite.scale.set(8, 4, 1);
  
  scene.add(countdownSprite);
  
  // Ajoute une lumière à la position du compteur pour éclairer la scène
  countdownLight = new THREE.PointLight(0xffc864, 2.5, 15, 1.5);
  countdownLight.position.copy(countdownPosition);
  scene.add(countdownLight);
  
  // Mise à jour toutes les minutes pour recalculer les jours
  setInterval(() => {
    updateCountdown();
  }, 60 * 1000); // Toutes les minutes
}

async function updateCountdown() {
  if (!countdownSprite) return;
  
  // S'assure que la police est chargée
  await loadDecortFont();
  
  const days = getDaysUntilTarget();
  const text = `${days}`;
  
  const newTexture = createCountdownTexture(text);
  countdownSprite.material.map = newTexture;
  countdownSprite.material.needsUpdate = true;
  newTexture.needsUpdate = true;
}

function toggleGramophone() {
  if (!audioEl) return;

  // Définit la source audio avec le fichier MP3
  if (!audioEl.src) {
    audioEl.src = "assets/Clair_Obscur_Expedition_33.mp3";
    audioEl.loop = true;
    // Précharge l'audio pour éviter les délais
    audioEl.load();
  }

  // Vérifie l'état réel de l'audio pour éviter les désynchronisations
  const actuallyPlaying = !audioEl.paused && !audioEl.ended && audioEl.currentTime > 0;

  if (actuallyPlaying) {
    // Mise en pause
    audioEl.pause();
    isPlaying = false;
  } else {
    // Lecture ou reprise
    // Si c'est la première lecture ou si la piste est terminée, on remet à 0
    if (audioEl.currentTime === 0 || audioEl.ended) {
      audioEl.currentTime = 0;
    }
    
    const playPromise = audioEl.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
        })
        .catch((err) => {
          console.error("Lecture audio bloquée :", err);
          isPlaying = false;
        });
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  // Mise à jour de l’inertie des contrôles de caméra
  if (controls) {
    controls.update();
  }

  renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!canvas) {
    console.error("Canvas #scene introuvable.");
    return;
  }
  initScene();
});

