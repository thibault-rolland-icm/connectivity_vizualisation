import * as THREE from "three";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls";
import { assignSensorLabels, clearAllSensors, drawSensorsAndUpdateGlobalValues, sensorMaterial } from "../js/draw_sensors.js";
import { GUI } from '../node_modules/three/examples/jsm/libs/dat.gui.module';
import "regenerator-runtime/runtime.js";

import { addLightAndBackground } from "../js/add_light_and_background";
import { loadAndDrawCortexModel } from "../js/draw_cortex.js";
import { loadAndDrawSensors, 
  clearLoadAndDrawSensors, 
  loadAndAssignSensorLabels } from '../js/draw_sensors.js';
import { loadAndDrawLinks, clearAllLinks, generateLinkData, drawLinksAndUpdateVisibility } from "../js/link_builder/draw_links";
import { setupCamera } from '../js/setup_camera';
import { setupGui, guiParams } from '../js/setup_gui';
import { loadJsonData } from "../js/load_data";

const highlightedLinksPreviousMaterials = [];

let cortexVertUrl = require('../data/cortex_vert.csv');
let cortexTriUrl = require('../data/cortex_tri.csv');
let sensorLabelsUrl = require('../data/sensor_labels.csv');
let sensorCoordinatesUrl = require('../data/sensor_coordinates.csv');
let connectivityMatrixUrl = require('../data/conn_matrix_0.csv');

const GLOBAL_LAYER = 0,  LINK_LAYER = 1;

const cortexMaterial = new THREE.MeshStandardMaterial({
  color: 0xffc0cb,
  side: THREE.BackSide
});
const enlightenedSensorMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  reflectivity: 1
});

const linkMeshList = [];
const sensorMeshList = [];

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  preserveDrawingBuffer: true
});
const camera = new THREE.PerspectiveCamera();
const controls = new OrbitControls(camera, renderer.domElement);
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const gui = new GUI();

document.body.appendChild(renderer.domElement);
const sensorNameDiv = document.getElementById("sensorName");
const csvConnMatrixInput = document.getElementById("csvConnMatrixInput");
const csvNodePositionsInput = document.getElementById("csvNodePositions");
const csvNodeLabelsInput = document.getElementById("csvNodeLabels");
const jsonInput = document.getElementById("jsonInput");

//INTERSECTED is used to check wether the mouse intersects with a sensor
var INTERSECTED;

init();
animate();

function init() {
  THREE.Cache.enabled = true;
  setupGui();
  generateSceneElements();
  
  window.addEventListener("resize", onWindowResize);
  document.addEventListener("mousemove", onDocumentMouseMove);
  csvConnMatrixInput.addEventListener("change", handleConnectivityMatrixFileSelect, false);
  csvNodePositionsInput.addEventListener("change", handleMontageCoordinatesFileSelect, false);
  csvNodeLabelsInput.addEventListener("change", handleMontageLabelsFileSelect, false);
  jsonInput.addEventListener("change", handleJsonFileSelect, false);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  hoverDisplayUpdate();
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

async function generateSceneElements() {
  setupCamera();
  addLightAndBackground();
  loadAndDrawCortexModel();
  await loadAndDrawSensors(sensorCoordinatesUrl);
  await loadAndAssignSensorLabels(sensorLabelsUrl);
  await loadAndDrawLinks(connectivityMatrixUrl);
}

function onDocumentMouseMove(event) {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  const padding = 15;
  sensorNameDiv.style.top = event.clientY + padding + "px";
  sensorNameDiv.style.left = event.clientX + padding + "px";
}

function hoverDisplayUpdate() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length !== 0 && sensorMeshList.map(x=>x.mesh).includes(intersects[0].object)) {
    if (INTERSECTED != intersects[0].object) {
      emptyIntersected();
      INTERSECTED = intersects[0].object;
      fillIntersected();
    }
  }
  else{
    emptyIntersected();
  }
}

function emptyIntersected() {
  if (INTERSECTED) {
    INTERSECTED.material = sensorMaterial;
  }
  INTERSECTED = null;
  sensorNameDiv.innerHTML = "";
  while (highlightedLinksPreviousMaterials.length > 0) {
    const elem = highlightedLinksPreviousMaterials.shift();
    for (const linkMesh of linkMeshList
      .filter((linkMesh) => linkMesh.link.node1 === elem.node1 && linkMesh.link.node2 === elem.node2)){
      linkMesh.mesh.material = elem.material;
    }
  }
}

function fillIntersected() {
  INTERSECTED.material = enlightenedSensorMaterial;
  sensorNameDiv.innerHTML = INTERSECTED.name;
  for (const linkMesh of linkMeshList){
    if (linkMesh.link.node1 === INTERSECTED || linkMesh.link.node2 === INTERSECTED)
    {
      highlightedLinksPreviousMaterials.push({
        node1: linkMesh.link.node1,
        node2: linkMesh.link.node2,
        material: linkMesh.mesh.material});
      linkMesh.mesh.material = new THREE.LineBasicMaterial({
        color : new THREE.Color(1, 1, 1), 
        opacity: 1,
        transparent: false
      });
    }
  }
}

function getNewFileUrl(evt){
  if (evt.target.files.length === 0) { return; }
  const file = evt.target.files[0];
  return window.URL.createObjectURL(file);
}

function handleConnectivityMatrixFileSelect(evt) {
  const fileUrl = getNewFileUrl(evt);
  clearAllLinks();
  loadAndDrawLinks(fileUrl);
}

function handleMontageCoordinatesFileSelect(evt) {
  sensorCoordinatesUrl = getNewFileUrl(evt);
  guiParams.mneMontage = -1;
  clearLoadAndDrawSensors(sensorCoordinatesUrl);
}

function handleMontageLabelsFileSelect(evt) {
  sensorLabelsUrl = getNewFileUrl(evt);
  loadAndAssignSensorLabels(sensorLabelsUrl);
}

async function handleJsonFileSelect(evt){
  const jsonUrl = getNewFileUrl(evt);
  const jsonData = await loadJsonData(jsonUrl);
  const graph = jsonData.graph;
  const coordinatesList  = [];
  const labelList = [];
  const linkList = [];
  const sensorIdDict = {};
  for (const [key, value] of Object.entries(graph.nodes)){
    coordinatesList.push([value.position.x, value.position.y, value.position.z]);
    let label = '';
    if (value.label) { label = value.label; }
    labelList.push(label);
    sensorIdDict[key] = labelList.length - 1;
  }
  await clearAllLinks();
  await clearAllSensors();
  await drawSensorsAndUpdateGlobalValues(coordinatesList);
  assignSensorLabels(labelList);
  for (const [key, value] of Object.entries(graph.edges)){
    linkList.push(generateLinkData(
      sensorIdDict[value.source], 
      sensorIdDict[value.target], 
      value.metadata.corr_mat));
  }
  await drawLinksAndUpdateVisibility(linkList);
}

export {
    scene,
    camera,
    controls,
    renderer,
    linkMeshList,
    sensorMeshList,
    gui,
    cortexVertUrl, 
    cortexTriUrl, 
    cortexMaterial,
    sensorMaterial,
    GLOBAL_LAYER,
    LINK_LAYER,
    csvConnMatrixInput,
    csvNodePositionsInput,
    csvNodeLabelsInput,
    jsonInput
};