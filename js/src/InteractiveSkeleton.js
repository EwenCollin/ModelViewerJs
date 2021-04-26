import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../jsm/controls/TransformControls.js';

var InteractiveSkeleton = function(object) {
    var self = this;
    self.object = object;
    self.mesh = self.object.mesh;
    if (self.object.filename.endsWith(".gltf") || self.object.filename.endsWith(".glb")) self.mesh = self.object.mesh.scene;
    self.animations = self.object.animations;
    self.skeletonMesh = new THREE.Group();
    self.mesh.add(self.skeletonMesh);
    self.raycaster = new THREE.Raycaster();
    self.boneControls;
    self.boneMap = [];
    self.boneArray = [];
    self.selectedBone;

    self.skinnedMesh = [];
    self.skeleton = [];
    self.geometryAttributes = [];
    self.initialPositions = [];
    self.initialBonesMatrix = [];
    self.initialMeshMatrix;


    self.init = function() {
        self.mesh.traverse(function(child) {
            if ( child.isMesh ) {
				if (child.skeleton) {
					console.log(child.skeleton);
                    self.skeleton.push(child.skeleton);
                    self.geometryAttributes.push(child.geometry.attributes);
                    self.skinnedMesh.push(child);
                    self.boneMap.push({});
				}
			}
        });

        var createBoneMesh = function(vTo, vFrom, skeletonID) {
            
            var bone = new THREE.Group();
            bone.applyMatrix4(vTo.matrixWorld);
            bone.updateMatrixWorld(true);

            var geometry = new THREE.ConeBufferGeometry(1, 1, 4, 1);
            geometry.rotateX(Math.PI/2);
            geometry.translate(0, 0, 0.5);
            var boneColor = 0xFFFF00;
            if (parseInt(skeletonID) !== 1) {
                boneColor = 0xEE00EE;
            }
            var material = new THREE.MeshPhongMaterial({color: boneColor, transparent: true, opacity: 0.5});
            var boneMesh = new THREE.Mesh(geometry, material);
            boneMesh.material.depthTest = false;

            boneMesh.position.setFromMatrixPosition(vTo.matrixWorld);
            boneMesh.updateMatrixWorld(true);
            var targetPos = new THREE.Vector3();
            targetPos.setFromMatrixPosition(vFrom.matrixWorld);
            var eyePos = new THREE.Vector3();
            eyePos.setFromMatrixPosition(vTo.matrixWorld);
            boneMesh.up = new THREE.Vector3(0, 0, 1);
            boneMesh.lookAt(targetPos);
            boneMesh.scale.set(2.25, 2.25, eyePos.distanceTo(targetPos));
            if(vTo.matrixWorld.equals(vFrom.matrixWorld)) boneMesh.scale.set(2.25, 2.25, 2.25);

            bone.attach(boneMesh);

            return bone;
        }


        var tempBoneArrays = [];
        for(var s in self.skeleton) {
            var skeletonBoneArray = [];
            for(var c in self.skeleton[s].bones) {
                skeletonBoneArray.push(self.skeleton[s].bones[c].uuid);
            }
            tempBoneArrays.push(skeletonBoneArray);
        }


        var indexBoneRecursive = function(parent, currentBone) {
            if(currentBone.children.length > 0) {
                for(var c in currentBone.children) {
                    var bone = createBoneMesh(currentBone, currentBone.children[c], 1);
                    parent.attach(bone);
                    indexBoneRecursive(bone, currentBone.children[c]);
                }
            }
            else {
                
            }
            for(var s in tempBoneArrays) {
                if(tempBoneArrays[s].includes(currentBone.uuid)) {
                    self.boneMap[s][currentBone.uuid] = bone;
                }
            }
        }

        
        indexBoneRecursive(self.skeletonMesh, self.skeleton[s].bones[0]);

        for(var s in self.skeleton) {
            var boneArraySingle = [];
            var initialBonesMatrixSingle = [];
            for(var c = 0; c < self.skeleton[s].bones.length; c++) {
                if(self.boneMap[s][self.skeleton[s].bones[c].uuid] !== undefined) {
                    self.boneMap[s][self.skeleton[s].bones[c].uuid].updateMatrixWorld(true);
                    boneArraySingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid]);
                    //console.log(self.boneMap[s][self.skeleton[s].bones[c].uuid]);
                    //console.log("skeleton:", s, " bone:", c, "full:", self.boneMap, self.skeleton[s].bones[c].uuid, tempBoneArrays);
                    initialBonesMatrixSingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid].matrixWorld.clone().invert());
                }
                else {
                    console.log("invalid uuid for bone");
                }
            }
            self.boneArray.push(boneArraySingle);
            self.initialBonesMatrix.push(initialBonesMatrixSingle);
            self.initialPositions.push(self.geometryAttributes[s].position.clone());
        }

        self.initialMeshMatrix = self.mesh.matrixWorld.clone();

        /*
        for(var s in self.skinnedMesh) {
            self.skinnedMesh[s].matrixAutoUpdate = false;
        }*/

    }
    self.init();

    self.raycast = function(mouse, objects, rendererDomElement, camera) {
        const rect = rendererDomElement.getBoundingClientRect();
        var pos = new THREE.Vector2((mouse.x - rect.left) / rect.width, (mouse.y - rect.top) / rect.height);
        var rayPos = new THREE.Vector2((pos.x * 2) - 1, - (pos.y * 2) + 1);
        self.raycaster.setFromCamera(rayPos, camera);
        return self.raycaster.intersectObjects(objects, true);
    }

    self.select = function(mouse, rendererDomElement, camera) {
        var objectsToIntersect = self.skeletonMesh.children;
        var rayResult = self.raycast(mouse, objectsToIntersect, rendererDomElement, camera);
        console.log(rayResult);
        if(rayResult.length > 0) {
            var selectedObject = rayResult[0].object.parent;
            console.log(selectedObject);
            self.boneControls.attach(selectedObject);
            self.selectedBone = {mesh: selectedObject, lastRotation: selectedObject.quaternion.clone()};
        }
    }

    self.updateGeometry = function() {
        var objMatrixWorld_inv = self.mesh.matrixWorld.clone().invert();
        var objInitialMatrixWorld_inv = self.initialMeshMatrix.clone().invert();
        var A1 = new THREE.Matrix4();
        var A2 = new THREE.Matrix4();
        var M = new THREE.Matrix4();
        var Mf = new THREE.Matrix4();
        var vertexPosition = new THREE.Vector3();
        //TODO : replace Vec4 with array to store more weights if needed
        var boneIndex = new THREE.Vector4();
        var boneWeight = new THREE.Vector4();
        for(var s in self.skeleton) {
            var vertexPositionsAttribute = self.initialPositions[s];

            var vertexIndexAttribute = self.geometryAttributes[s].skinIndex;

            var boneWeightAttribute = self.geometryAttributes[s].skinWeight;

            var vertexCount = vertexPositionsAttribute.count;
            var outputVertexArray = self.geometryAttributes[s].position.array;

            for(var Kvertex = 0; Kvertex < vertexCount; Kvertex++) {
                vertexPosition.fromBufferAttribute(vertexPositionsAttribute, Kvertex);
                boneIndex.fromBufferAttribute(vertexIndexAttribute, Kvertex);
                boneWeight.fromBufferAttribute(boneWeightAttribute, Kvertex);
                
                //if(self.skeleton.length === 1) boneIndex = boneIndex - 1;
                //if (boneIndex >= self.boneArray.length) console.log(boneIndex);
                //if (!self.boneArray[s][boneIndex]) console.log("undefined bone", s, boneIndex);


                Mf.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
                
                //TODO : use the item size of vertexIndexAttribute to use the following loop (4 is constant but should be replaced)
                for(var Kdependency = 0; Kdependency < 4; Kdependency++) {

                    var i = boneIndex.getComponent(Kdependency);

                    var T = self.boneArray[s][i].matrixWorld;
                    var T0_inv = self.initialBonesMatrix[s][i];

                    var weight = boneWeight.getComponent(Kdependency);

                    M.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));

                    for(var n = 0; n < 16; n++) {
                        Mf.elements[n] += M.elements[n] * weight;
                    }

                }
                
                vertexPosition.applyMatrix4(Mf);

                /*

                var T = self.boneArray[s][boneIndex].matrixWorld;
                var T0_inv = self.initialBonesMatrix[s][boneIndex];

                vertexPosition.applyMatrix4(M.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix)));
                */
                
                outputVertexArray[Kvertex*3] = vertexPosition.x;
                outputVertexArray[Kvertex*3 + 1] = vertexPosition.y;
                outputVertexArray[Kvertex*3 + 2] = vertexPosition.z;
    
            }
            self.geometryAttributes[s].position.needsUpdate = true;
        }
        
    }



    self.tick = function(boneControls) {

        self.boneControls = boneControls;
        /*
        for(var s in self.skinnedMesh) {
            self.skinnedMesh[s].matrix.copy(self.mesh.matrix.clone().invert());
            self.skinnedMesh[s].matrixAutoUpdate = false;
            self.skinnedMesh[s].updateMatrixWorld(true);
        }*/

        for(var s in self.boneArray) {
            for(var c in self.boneArray[s]) {
                self.boneArray[s][c].updateMatrixWorld(true);
            } 
        }
        self.updateGeometry();
        //self.skeletonMesh.scale.copy(tempScale);

    }
}

export {InteractiveSkeleton};