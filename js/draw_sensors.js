import * as THREE from 'three';
import { scene, 
    sensorMeshList
 } from "../public/main.js";
import { csv3dCoordinatesOnLoadCallBack, loadData } from "./load_data.js";
import { clearAllLinks } from './link_builder/draw_links';
import { deleteMesh } from "./mesh_helper";
import { drawAllDegreeLines } from './draw_degree_line.js';

let sensorCount = 0;

const montageBarycenter = new THREE.Vector3();

const SENSOR_RADIUS = 3 * 10;
const SENSOR_SEGMENTS = 20;
const SENSOR_RINGS = 50;

const SCALE_FACTOR = 100;

const sensorMaterial =  new THREE.MeshPhysicalMaterial({
    color: 0xaaaaaa,
    opacity: 1.,
    transparent: true,
    reflectivity: 1
  });

let maxSensorDistance = 0.;

async function clearLoadAndDrawSensors(sensorCoordinatesUrl, sensorLabelsUrl){
    await clearAllLinks();
    await clearAllSensors();
    await loadAndDrawSensors(sensorCoordinatesUrl);
    if (sensorLabelsUrl){
        await loadAndAssignSensorLabels(sensorLabelsUrl);
    }
}

async function loadAndDrawSensors(sensorCoordinatesUrl) {  
    const data = await loadSensorCoordinates(sensorCoordinatesUrl);
    await drawSensorsAndUpdateGlobalValues(data);

}
async function drawSensorsAndUpdateGlobalValues(data){
    await getMontageBarycenter(data);
    await drawAllSensors(data);
    await setMaxSensorDistance();
    await drawAllDegreeLines();
}


async function loadSensorCoordinates(sensorCoordinatesUrl) {
    const data = await loadData(sensorCoordinatesUrl, 'sensor coordinates', csv3dCoordinatesOnLoadCallBack);
    return data;
}

//TODO: check if number fo labels correspond to number of nodes
async function loadAndAssignSensorLabels(sensorLabelsUrl){
    const labelList = await loadSensorLabels(sensorLabelsUrl);
    assignSensorLabels(labelList);
}

function assignSensorLabels(labelList){
    for (let i = 0; i < labelList.length; i++){
        const label = labelList[i];
        sensorMeshList[i].mesh.name = label;
    }
}

function loadSensorLabels(sensorLabelsUrl){
    return loadData(sensorLabelsUrl, 'sensor labels');
}

async function drawAllSensors(coordinatesList){
    const meanSensorDistance = await getMeanSensorDistance(coordinatesList);
    sensorCount = coordinatesList.length;
    for (let coordinates of coordinatesList) {
        await drawSensor(coordinates, meanSensorDistance);
      }
}

async function drawSensor(coordinates, meanSensorDistance){
    const radiusScale = 1 / Math.max(Math.sqrt(sensorCount), Math.sqrt(8));
    const sensorGeometry = new THREE.SphereGeometry(
        SENSOR_RADIUS * radiusScale, 
        SENSOR_SEGMENTS, 
        SENSOR_RINGS);
    let sensor = new THREE.Mesh(
        sensorGeometry,
        sensorMaterial
    );
    sensor.castShadow = false;
    sensor.name = '';
    sensor.position.x = (coordinates[0]) / meanSensorDistance * SCALE_FACTOR - montageBarycenter.x;
    sensor.position.y = (coordinates[1]) / meanSensorDistance * SCALE_FACTOR - montageBarycenter.y;
    sensor.position.z = (coordinates[2]) / meanSensorDistance * SCALE_FACTOR - montageBarycenter.z;
    scene.add(sensor);
    sensorMeshList.push({mesh: sensor});
    return sensor;
}

async function setMaxSensorDistance(){
    maxSensorDistance = 0.;
    for (var i = 0; i < sensorMeshList.length; i++) {
        for (var j = 0; j < i; j++) {
            const _dist = sensorMeshList[i].mesh.position
                .distanceTo(sensorMeshList[j].mesh.position);
            if (maxSensorDistance <= _dist) {
                maxSensorDistance = _dist;
            }
        }
    }
}

async function getMeanSensorDistance(positions){
    let meanSensorDistance = 0.;
    let count = 0;
    for (var i = 0; i < positions.length; i++) {
        for (var j = 0; j < i; j++) {
            const _dist = new THREE.Vector3(positions[i][0], positions[i][1], positions[i][2])
                .distanceTo(new THREE.Vector3(positions[j][0], positions[j][1], positions[j][2]))
            count++;
            meanSensorDistance += _dist;
        }
    }
    return meanSensorDistance / count;
}

async function getMontageBarycenter(positions){
    let x = 0;
    let y = 0;
    let z = 0;
    for (let position of positions) {
        x += position[0];
        y += position[1];
        z += position[2];
    }
    montageBarycenter.set(
        x/positions.length,
        y/positions.length,
        z/positions.length
    );
}

async function clearAllSensors(){
    while (sensorMeshList.length){
        const sensor = sensorMeshList.pop();
        deleteMesh(sensor.mesh);
        if (sensor.degreeLine){
            deleteMesh(sensor.degreeLine);
        }
    } 
}

export {
    sensorMaterial,
    drawSensor,
    drawSensorsAndUpdateGlobalValues,
    loadAndDrawSensors, 
    loadAndAssignSensorLabels,
    clearLoadAndDrawSensors,
    assignSensorLabels,
    sensorMeshList, 
    sensorCount,
    maxSensorDistance, 
    clearAllSensors};
