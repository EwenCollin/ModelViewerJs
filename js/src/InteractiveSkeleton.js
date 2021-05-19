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

    self.threejsBoneMatrix = [];
    self.threejsBoneIndex = [];
    self.reprBoneMatrix = [];
    self.reprBoneIndex = [];

    self.transformGroup = new THREE.Group();
    self.mesh.attach(self.transformGroup);


    
    self.createBoneArrays = function(bones) {
        var boneIndex = [];
        var boneMatrix = [];
        for(var b = 0; b < bones.length; b++) {
            boneMatrix.push(bones[b].matrix);
            var i = 0;
            while(i < bones.length && bones[i].uuid !== bones[b].parent.uuid) {
                i++;
            }
            if(i === bones.length) {
                i = -1;
            }
            boneIndex.push(i);
        }
        return {"boneIndex": boneIndex, "boneMatrix": boneMatrix};
    }


    self.recalculateMatrix = function(boneMatrix, boneIndex) {
        var finalBoneMatrix = [];
        var currentBoneIndex = -1;
        var j = 0;
        for(var i = 0; i < boneMatrix.length; i++) {
            finalBoneMatrix.push(new THREE.Matrix4());
        }
        while (j < boneMatrix.length) {
            for(var b = 0; b < boneMatrix.length; b++) {
                if(boneIndex[b] === currentBoneIndex) {
                    if(currentBoneIndex !== -1) finalBoneMatrix[b].multiplyMatrices(finalBoneMatrix[currentBoneIndex], boneMatrix[b]);
                    else finalBoneMatrix[b].copy(boneMatrix[b]);
                    j++;
                }
            }
            currentBoneIndex++;
        }
        return finalBoneMatrix;
    }

    self.applyMatrixToRoot = function(boneMatrix, boneIndex, matrix) {
        var finalBoneMatrix = [];
        var i = 0;
        while(boneIndex[i] !== -1) {
            i++;
        }
        for(var m = 0; m < boneMatrix.length; m++) {
            var matrixCopy = new THREE.Matrix4();

            if(m === i) {
                matrixCopy.multiplyMatrices(matrix, boneMatrix[m]);
            }
            else {
                matrixCopy.copy(boneMatrix[m]); //refactor : remove else ?
            }
            finalBoneMatrix.push(matrixCopy);
        }
        return finalBoneMatrix;
    }

    self.updateReprMatrixWorld = function() {
        for(var s = 0; s < self.boneArray.length; s++) {
            var reprBoneMatrixWorld = self.applyMatrixToRoot(self.reprBoneMatrix[s], self.reprBoneIndex[s], self.skeletonMesh.matrixWorld);
            reprBoneMatrixWorld = self.recalculateMatrix(reprBoneMatrixWorld, self.reprBoneIndex[s]);
            for(var b = 0; b < self.boneArray[s].length; b++) {
                self.boneArray[s][b].matrixWorld.copy(reprBoneMatrixWorld[b]);
            }
        }
    }

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
        var rootMesh = createBoneMesh(rootBone, rootBone);
        
        indexBoneRecursive(rootMesh, rootBone);
        self.boneMap[s][rootBone.uuid] = rootMesh;
        self.skeletonMesh.attach(rootMesh);


        console.log("self.boneMap", self.boneMap);

        for(var s in self.skeleton) {
            var boneArraySingle = [];



            for(var c = 0; c < self.skeleton[s].bones.length; c++) {
                self.skeleton[s].bones[c].matrixAutoUpdate = false;
                if(self.boneMap[s][self.skeleton[s].bones[c].uuid] !== undefined) {
                    //self.boneMap[s][self.skeleton[s].bones[c].uuid].updateMatrixWorld(true);
                    boneArraySingle.push(self.boneMap[s][self.skeleton[s].bones[c].uuid]);
                    
                    
                    self.boneMap[s][self.skeleton[s].bones[c].uuid].matrixAutoUpdate = false;


                }
                else {
                    console.log("invalid uuid for bone");//, self.skeleton[s].bones[c]);
                }
            }
            self.boneArray.push(boneArraySingle);




        }
        console.log(self.boneArray);


        for(var s in self.skeleton) {

            self.initialPositions.push(self.geometryAttributes[s].position.clone());

            var threejsJointsData = self.createBoneArrays(self.skeleton[s].bones);
            self.threejsBoneIndex.push(threejsJointsData["boneIndex"]);
            self.threejsBoneMatrix.push(threejsJointsData["boneMatrix"]);

            var reprJointsData = self.createBoneArrays(self.skeleton[s].bones);
            self.reprBoneIndex.push(reprJointsData["boneIndex"]);
            self.reprBoneMatrix.push(reprJointsData["boneMatrix"]);
            
            /*
            var reprBoneMatrixWorld = self.applyMatrixToRoot(reprJointsData["boneMatrix"], reprJointsData["boneIndex"], self.skeletonMesh.matrixWorld);
            reprBoneMatrixWorld = self.recalculateMatrix(reprBoneMatrixWorld, reprJointsData["boneIndex"]);

            
            for(var m = 0; m < reprJointsData["boneMatrix"].length; m++) {
                //self.boneArray[s][m].matrix.copy(threejsJointsData["boneMatrix"][m]);
                //self.boneArray[s][m].matrixWorld.copy(self.skeleton[s].bones[m].matrixWorld);
                self.boneArray[s][m].matrixWorld.copy(reprBoneMatrixWorld[m]);



                if(!reprJointsData["boneMatrix"][m].equals(threejsJointsData["boneMatrix"][m])) console.log("WARN : ambiguity");
                else console.log("everything is fine");
            }*/

        }

        self.updateReprMatrixWorld();
        /*
        for(var s in self.skeleton) {
            for(var m = 0; m < self.reprBoneMatrix[s].length; m++) {
                if(!self.reprBoneMatrix[s][m].equals(self.threejsBoneMatrix[s][m])) console.log("WARN : ambiguity in relative Matrix");
                else console.log("everything is fine in relative Matrix");
            }
        }
        for(var s in self.skeleton) {
            for(var m = 0; m < self.reprBoneMatrix[s].length; m++) {
                if(!self.boneArray[s][m].matrixWorld.equals(self.skeleton[s].bones[m].matrixWorld)) console.log("WARN : ambiguity in world Matrix");
                else console.log("everything is fine in world Matrix");
            }
        }*/


        //console.log("reprBoneMatrix", self.reprBoneMatrix);
        //console.log("threejsBoneMatrix", self.threejsBoneMatrix);

        //console.log("reprBoneMatrixWorld", self.boneArray);
        //console.log("threejsBoneMatrixWorld", self.skeleton);

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

            selectedObject.add(self.transformGroup);
            self.transformGroup.position.set(0, 0, 0);
            self.transformGroup.rotation.set(0, 0, 0);
            self.transformGroup.scale.set(1, 1, 1);

            self.boneControls.attach(self.transformGroup);
            self.selectedBone = {mesh: selectedObject, lastMatrix: self.transformGroup.matrix.clone()};
        }
    }

    self.updateGeometry = function() {

        var A1 = new THREE.Matrix4();
        var A2 = new THREE.Matrix4();
        var B1 = new THREE.Matrix4();
        var B2 = new THREE.Matrix4();
        var R1 = new THREE.Matrix4();
        var R2 = new THREE.Matrix4();
        var delta_T_representation = new THREE.Matrix4();
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

            var boneMatrix = self.recalculateMatrix(self.reprBoneMatrix[s], self.reprBoneIndex[s]);


            var reprBoneMatrixWorld = self.recalculateMatrix(self.reprBoneMatrix[s], self.reprBoneIndex[s]);

            var threejsBoneMatrixWorld_inv = self.recalculateMatrix(self.threejsBoneMatrix[s], self.threejsBoneIndex[s]);
            for(var m in threejsBoneMatrixWorld_inv) {
                threejsBoneMatrixWorld_inv[m].invert();
            }

            for(var Kvertex = 0; Kvertex < vertexCount; Kvertex++) {
                boneIndex.fromBufferAttribute(vertexIndexAttribute, Kvertex);
                boneWeight.fromBufferAttribute(boneWeightAttribute, Kvertex);

                vertexPosition.fromBufferAttribute(vertexPositionsAttribute, Kvertex);


                Mf.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
                
                //TODO : use the item size of vertexIndexAttribute to use the following loop (4 is constant but should be replaced)
                for(var Kdependency = 0; Kdependency < 4; Kdependency++) {

                    var i = boneIndex.getComponent(Kdependency);
                    if(self.boneArray[s][i]) {
                        var T = reprBoneMatrixWorld[i];
                        var T0_inv = threejsBoneMatrixWorld_inv[i];
                        var weight = boneWeight.getComponent(Kdependency);
                        /*
                        var T = self.boneArray[s][i].matrix;//self.skeleton[s].bones[i].matrixWorld;
                        var T_initial_inv = self.jointsTransformMatrices[s][i];
                        var T0_inv = self.initialBonesMatrix[s][i];
                        var T0 = self.tmp_boneBindMatrices[s][i];
    
                        //M.multiplyMatrices(T, T0_inv);
                        //R2.multiplyMatrices(B1.multiplyMatrices(objMatrixWorld_inv, self.skeleton[s].bones[i].matrixWorld), B2.multiplyMatrices(self.jointsTransformMatrices[s][i], self.initialMeshMatrix));
                        //R1.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));
                        //B1.multiplyMatrices(T, self.jointsTransformMatrices[s][i]);
                        //B2.multiplyMatrices(T0_inv, self.tmp_rootBoneMatrix);
                        delta_T_representation.multiplyMatrices(T, T_initial_inv);
                        R1.multiplyMatrices(objMatrixWorld_inv, A1.multiplyMatrices(delta_T_representation, T0));
                        R2.multiplyMatrices(T0_inv, self.initialMeshMatrix);
                        M.multiplyMatrices(R1, R2);
                        
                        // p = bindMatrixInverse * T * T0_Inverse * bindMatrix p0
                        //bindMatrix = meshMatrix * jointMatrix_inverse ?
                        //M.multiplyMatrices(R1, R2);
                        //M.multiplyMatrices(A1.multiplyMatrices(objMatrixWorld_inv, T), A2.multiplyMatrices(T0_inv, self.initialMeshMatrix));*/
                        
                        M.multiplyMatrices(T, T0_inv);

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

        self.updateReprMatrixWorld();
        
        self.updateGeometry();

    }
}

export {InteractiveSkeleton};