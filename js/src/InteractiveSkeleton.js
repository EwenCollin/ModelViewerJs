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

    self.jointsTransformMatrices = [];

    self.rawDeformer;


    self.init = function() {
        self.mesh.traverse(function(child) {
            if ( child.isMesh ) {
				if (child.skeleton) {
					console.log(child.skeleton);
                    self.skeleton.push(child.skeleton);
                    self.geometryAttributes.push(child.geometry.attributes);
                    self.rawDeformer = child.geometry.FBX_Deformer;
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
        var tempMap = [];
        for(var s in self.skeleton) {
            var skeletonBoneArray = [];
            for(var c in self.skeleton[s].bones) {
                skeletonBoneArray.push(self.skeleton[s].bones[c].uuid);
            }
            tempMap.push({});
            tempBoneArrays.push(skeletonBoneArray);
        }

        
        var indexBoneRecursive = function(parentMesh, parentBone) {
            if(parentBone.children.length === 0) {
                var bone = createBoneMesh(parentBone, parentBone);
                parentMesh.attach(bone);
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.uuid)) {
                        self.boneMap[s][parentBone.uuid] = bone;
                    }
                }
            } else {
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.uuid)) {
                        self.boneMap[s][parentBone.uuid] = parentMesh;
                    }
                }
            }
            
            if(parentBone.parent.isBone) {
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.parent.uuid)) {
                        self.boneMap[s][parentBone.parent.uuid] = parentMesh;
                    }
                }
            }
            for(var c in parentBone.children) {
                var bone = createBoneMesh(parentBone, parentBone.children[c], 1);
                parentMesh.attach(bone);
                indexBoneRecursive(bone, parentBone.children[c]);
            }
        }

        var getParent = function(child) {
            if(child.parent && child.parent.isBone) return getParent(child.parent);
            return child;
        }


        var rootBone = getParent(self.skeleton[s].bones[0]);
        indexBoneRecursive(self.skeletonMesh, rootBone);
        self.boneMap[s][rootBone.uuid] = self.skeletonMesh.children[0];

        console.log("self.boneMap", self.boneMap);

        for(var s in self.skeleton) {
            var boneArraySingle = [];
            var initialBonesMatrixSingle = [];
            var jointsTransformMatricesSingle = [];
            for(var c = 0; c < self.skeleton[s].bones.length; c++) {
                if(self.boneMap[s][self.skeleton[s].bones[c].uuid] !== undefined) {
                    self.boneMap[s][self.skeleton[s].bones[c].uuid].updateMatrixWorld(true);
                    boneArraySingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid]);
                    initialBonesMatrixSingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid].matrixWorld.clone().invert());

                    jointsTransformMatricesSingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid].matrixWorld.clone().invert());
                }
                else {
                    console.log("invalid uuid for bone");//, self.skeleton[s].bones[c]);
                }
            }
            self.jointsTransformMatrices.push(jointsTransformMatricesSingle);
            self.boneArray.push(boneArraySingle);
            self.initialBonesMatrix.push(initialBonesMatrixSingle);
            self.initialPositions.push(self.geometryAttributes[s].position.clone());
        }
        console.log(self.boneArray);

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
        var B1 = new THREE.Matrix4();
        var B2 = new THREE.Matrix4();
        var R1 = new THREE.Matrix4();
        var R2 = new THREE.Matrix4();
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
                boneIndex.fromBufferAttribute(vertexIndexAttribute, Kvertex);
                boneWeight.fromBufferAttribute(boneWeightAttribute, Kvertex);

                vertexPosition.fromBufferAttribute(vertexPositionsAttribute, Kvertex);


                Mf.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
                
                //TODO : use the item size of vertexIndexAttribute to use the following loop (4 is constant but should be replaced)
                for(var Kdependency = 0; Kdependency < 4; Kdependency++) {

                    var i = boneIndex.getComponent(Kdependency);
                    if(self.boneArray[s][i]) {
                        var T = self.boneArray[s][i].matrixWorld;//self.skeleton[s].bones[i].matrixWorld;
                        var T0_inv = self.initialBonesMatrix[s][i];
    
                        var weight = boneWeight.getComponent(Kdependency);
                        //M.multiplyMatrices(T, T0_inv);
                        R2.multiplyMatrices(B1.multiplyMatrices(objMatrixWorld_inv, self.skeleton[s].bones[i].matrixWorld), B2.multiplyMatrices(self.jointsTransformMatrices[s][i], self.initialMeshMatrix));
                        R1.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));
                        M.multiplyMatrices(R1, R2);
                        //M.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));
    
                        for(var n = 0; n < 16; n++) {
                            Mf.elements[n] += M.elements[n] * weight;
                        }
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

        for(var s in self.boneArray) {
            for(var c in self.boneArray[s]) {
                self.boneArray[s][c].updateMatrixWorld(true);
            } 
        }

        var A1 = new THREE.Matrix4();
        var A2 = new THREE.Matrix4();
        var M = new THREE.Matrix4();
        /*
        for(var s in self.boneMap) {
            for(var b in self.skeleton[s].bones) {
                var bone = self.skeleton[s].bones[b];
                //if (bone.parent.isBone) bone.matrixWorld.copy(self.boneArray[s][b].parent.matrixWorld);//copy(self.boneArray[s][b].matrixWorld);
                bone.matrixWorld.copy(self.boneArray[s][b].matrixWorld);
                bone.matrixAutoUpdate = false;
            }
        }*/

        /*
        var bonePos = new THREE.Vector3();
        self.geometryAttributes[0].position.copy(self.initialPositions[0]);
        for(var v = 0; v < self.geometryAttributes[0].position.count; v++) {
            
            self.skinnedMesh[0].boneTransform(v, bonePos);
            self.geometryAttributes[0].position.array[v*3] = bonePos.x;
            self.geometryAttributes[0].position.array[v*3 + 1] = bonePos.y;
            self.geometryAttributes[0].position.array[v*3 + 2] = bonePos.z;
        }
        self.geometryAttributes[0].position.needsUpdate = true;
        */
        self.updateGeometry();
        //self.skeletonMesh.scale.copy(tempScale);

    }
}

export {InteractiveSkeleton};