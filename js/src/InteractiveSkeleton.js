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
            var bone = createBoneMesh(parentBone.parent, parentBone, 1);
            parentMesh.attach(bone);
            
            /*
            for(var s in tempBoneArrays) {
                if(tempBoneArrays[s].includes(parentBone.parent.uuid)) {
                    self.boneMap[s][parentBone.uuid] = bone;
                }
            }*/
            for(var c in parentBone.children) {
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.uuid) && parentBone.children.length === 1) {
                        self.boneMap[s][parentBone.uuid] = indexBoneRecursive(bone, parentBone.children[c]);
                    }
                    else {
                        self.boneMap[s][parentBone.uuid] = bone;
                        indexBoneRecursive(bone, parentBone.children[c]);
                    }
                }
            }
            if(parentBone.children.length === 0) {
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.parent.uuid) && parentBone) {
                        self.boneMap[s][parentBone.uuid] = bone;
                    }
                }
            }
            return bone;
        }
        
        /*
        var indexBoneRecursive = function(parentBone, rootMesh) {
            if(parentBone.parent && parentBone.parent.isBone) {
                var currentBone = createBoneMesh(parentBone.parent, parentBone);
            }
            else var currentBone = rootMesh;
            var children = [];
            for(var c = 0; c < parentBone.children.length; c++) {
                var child = parentBone.children[c];
                children.push([indexBoneRecursive(child), child]);
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(child.uuid)) self.boneMap[s][child.uuid] = children[children.length - 1][0];
                }
            }
            
            for(var i = 0; i < children.length; i++) {
                
                if(children[i][1].children.length === 0 && parentBone.children.length === 2) {
                    for(var c in parentBone.children) {
                        if (parentBone.children[c].uuid !== children[i][1].uuid && parentBone.children[c].children.length > 0) {
                            
                            for(var s in tempBoneArrays) {
                                if(tempBoneArrays[s].includes(children[i][1].uuid)) {
                                    self.boneMap[s][children[i][1].uuid] = children[i][0];
                                }
                            }
                            children[c][0].attach(children[i][0]);
                        }
                    }
                }
                else currentBone.attach(children[i][0]);
            }
            return currentBone;
        }*/

        
        var indexBoneRecursive = function(parentMesh, parentBone) {
            for(var c in parentBone.children) {
                var bone = createBoneMesh(parentBone, parentBone.children[c], 1);
                parentMesh.attach(bone);
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.children[c].uuid)) {
                        self.boneMap[s][parentBone.children[c].uuid] = bone;
                    }
                }
                indexBoneRecursive(bone, parentBone.children[c]);
            }
        }

        indexBoneRecursive(self.skeletonMesh, self.skeleton[s].bones[0]);
        self.boneMap[s][self.skeleton[s].bones[0].uuid] = self.skeletonMesh;
        console.log("self.boneMap", self.boneMap);
        /*
        var skeletonCloneMap = {};
        var cloneSkeleton = function(parent) {
            var clone = parent.clone();
            skeletonCloneMap[parent.uuid] = clone;
            for(var i = 0; i < parent.children.length; i++) {
                clone.attach(cloneSkeleton(parent.children[i]));
            }
            return clone;
        }

        self.skeletonMesh.attach(self.skeleton[1].bones[0]);

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

        var indexBoneRecursive = function(parentBone) {
            var children = [];
            for(var c in parentBone.children) {
                var bone = createBoneMesh(parentBone, parentBone.children[c], 1);
                children.push(bone);
                
                for(var s in tempBoneArrays) {
                    if(tempBoneArrays[s].includes(parentBone.children[c].uuid)) {
                        self.boneMap[s][parentBone.children[c].uuid] = bone;
                    }
                }
                indexBoneRecursive(parentBone.children[c]);
            }
            for(var c in children) {
                parentBone.attach(children[c]);
            }
        }

        indexBoneRecursive(self.skeletonMesh.children[0]);
        */

        console.log("next step");
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
                    console.log("invalid uuid for bone");//, self.skeleton[s].bones[c]);
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
                    if(self.boneArray[s][i]) {
                        var T = self.boneArray[s][i].matrixWorld;
                        var T0_inv = self.initialBonesMatrix[s][i];
    
                        var weight = boneWeight.getComponent(Kdependency);
    
                        M.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));
    
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