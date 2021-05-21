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
    self.skeletonMesh.matrixAutoUpdate = false;
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

    self.globalJointIndex = [];

    self.rootJointMatrix;

    self.transformGroup = new THREE.Group();
    self.skeletonMesh.attach(self.transformGroup);
    self.transformGroup.matrixAutoUpdate = false;
    self.transformGroupSub = new THREE.Group();
    self.transformGroup.attach(self.transformGroupSub);
    
    self.MODE = {
        MOVE: "move",
        ROTATE: "rotate"
    }

    self.TRANSFORM_MODE = self.MODE.ROTATE;
    
    
    self.createBoneArrays = function(bones) {
        var boneIndex = [];
        var boneMatrix = [];
        for(var b = 0; b < bones.length; b++) {
            boneMatrix.push(bones[b].matrix.clone());
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


    self.createBoneRepr = function(jointMatrix, jointIndex) {

        var createBoneMesh = function(vTo, vFrom, skeletonID) {
            
            var bone = new THREE.Group();
            bone.applyMatrix4(vTo);
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
    
            boneMesh.position.setFromMatrixPosition(vTo);
            boneMesh.updateMatrixWorld(true);
            var targetPos = new THREE.Vector3();
            targetPos.setFromMatrixPosition(vFrom);
            var eyePos = new THREE.Vector3();
            eyePos.setFromMatrixPosition(vTo);
            boneMesh.up = new THREE.Vector3(0, 0, 1);
            boneMesh.lookAt(targetPos);
            boneMesh.scale.set(2.25, 2.25, eyePos.distanceTo(targetPos));
            if(vTo.equals(vFrom)) boneMesh.scale.set(2.25, 2.25, 2.25);
    
            bone.attach(boneMesh);
    
            return bone;
        }
        
        var jointGlobalMatrix = self.applyMatrixToRoot(jointMatrix, jointIndex, self.rootJointMatrix);
        jointGlobalMatrix = self.recalculateMatrix(jointGlobalMatrix, jointIndex);
        
        var finalJointRepr = [];
        var j = 0;
        for(var i = 0; i < jointMatrix.length; i++) {
            finalJointRepr.push(null);
        }
        for(var i = 0; i < jointMatrix.length; i++) {
            if(jointIndex[i] === -1) finalJointRepr[i] = createBoneMesh(jointGlobalMatrix[i], jointGlobalMatrix[i]);
            for(var j = 0; j < jointMatrix.length; j++) {
                if(jointIndex[i] === j) {
                    finalJointRepr[i] = createBoneMesh(jointGlobalMatrix[i], jointGlobalMatrix[j]);
                }
            }
        }
        
        console.log(finalJointRepr);
        for(var j = 0; j < finalJointRepr.length; j++) {
            finalJointRepr[j].matrixAutoUpdate = false;
            self.skeletonMesh.attach(finalJointRepr[j]);
        }
        var skeletonMeshMatrix = new THREE.Matrix4();
        self.skeletonMesh.matrix.copy(skeletonMeshMatrix.multiplyMatrices(self.rootJointMatrix, self.mesh.matrixWorld.clone().invert()));
        self.boneArray = finalJointRepr;
    }

    self.updateRepr = function() {
        //var reprBoneMatrixGlobal = self.applyMatrixToRoot(self.reprBoneMatrix, self.reprBoneIndex, self.rootJointMatrix);
        var reprBoneMatrixGlobal = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
        for(var i = 0; i < self.boneArray.length; i++) {
            if(self.reprBoneIndex[i] !== -1) self.boneArray[i].matrix.copy(reprBoneMatrixGlobal[i]);
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
        var meshJoints = [];
        var meshJointsIndex = 0;
        for(var s = 0; s < self.skeleton.length; s++) {
            self.initialPositions.push(self.geometryAttributes[s].position.clone());
            self.globalJointIndex.push([]);
            for(var j = 0; j < self.skeleton[s].bones.length; j++) {
                meshJoints.push(self.skeleton[s].bones[j]);
                self.globalJointIndex[s].push(meshJointsIndex);
                meshJointsIndex++;
            }
        }
        var threejsJointsData = self.createBoneArrays(meshJoints);
        self.threejsBoneIndex = threejsJointsData["boneIndex"];
        self.threejsBoneMatrix = threejsJointsData["boneMatrix"];

        var reprJointsData = self.createBoneArrays(meshJoints);
        self.reprBoneIndex = reprJointsData["boneIndex"];
        self.reprBoneMatrix = reprJointsData["boneMatrix"];
        var getRoot = function(child) {
            if(child.parent && child.parent.isBone) return getRoot(child.parent);
            return child;
        }
        var rootJoint = getRoot(self.skeleton[0].bones[0]);
        self.rootJointMatrix = rootJoint.parent.matrixWorld;
        self.createBoneRepr(self.reprBoneMatrix, self.reprBoneIndex);
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
        if(rayResult.length > 0) {
            var selectedObject = rayResult[0].object.parent;
            
            var globalReprMatrix = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
            self.transformGroup.matrix.copy(globalReprMatrix[self.retrieveReprBoneFromUUID(selectedObject.uuid)]);
            self.transformGroupSub.position.set(0, 0, 0);
            self.transformGroupSub.rotation.set(0, 0, 0);
            self.transformGroupSub.scale.set(1, 1, 1);
            self.transformGroupSub.updateMatrix();
            
            self.boneControls.attach(self.transformGroupSub);
            self.selectedBone = {meshUUID: selectedObject.uuid, lastMatrix: self.transformGroupSub.matrix.clone().invert()};
        }
    }

    self.updateGeometry = function() {

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

            var reprBoneMatrixWorld = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
            var threejsBoneMatrixWorld_inv = self.recalculateMatrix(self.threejsBoneMatrix, self.threejsBoneIndex);
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
                    var T = reprBoneMatrixWorld[self.globalJointIndex[s][i]];
                    var T0_inv = threejsBoneMatrixWorld_inv[self.globalJointIndex[s][i]];
                    var weight = boneWeight.getComponent(Kdependency);
                    
                    M.multiplyMatrices(T, T0_inv);

                    for(var n = 0; n < 16; n++) {
                        Mf.elements[n] += M.elements[n] * weight;
                    }

                }
                vertexPosition.applyMatrix4(Mf);
                
                outputVertexArray[Kvertex*3] = vertexPosition.x;
                outputVertexArray[Kvertex*3 + 1] = vertexPosition.y;
                outputVertexArray[Kvertex*3 + 2] = vertexPosition.z;
    
            }
            self.geometryAttributes[s].position.needsUpdate = true;
        }
        
    }

    self.retrieveReprBoneFromUUID = function(uuid) {
        for(var j in self.boneArray) {
            if(self.boneArray[j].uuid === uuid) return j;
        }
        console.log(uuid, "not found in bones uuid");
    }

    self.applyTransform = function() {
        if(self.selectedBone !== undefined) {
            var transformMatrix = new THREE.Matrix4();
            var boneIndex = self.retrieveReprBoneFromUUID(self.selectedBone.meshUUID);
            transformMatrix.multiplyMatrices(self.transformGroupSub.matrix, self.selectedBone.lastMatrix);
            self.reprBoneMatrix[boneIndex].multiply(transformMatrix);
            self.selectedBone.lastMatrix.copy(self.transformGroupSub.matrix).invert();
        }
    }

    self.tick = function(boneControls) {

        self.boneControls = boneControls;
        
        self.applyTransform();
        self.updateRepr();

        self.updateGeometry();

    }
}

export {InteractiveSkeleton};