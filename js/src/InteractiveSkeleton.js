import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../jsm/controls/TransformControls.js';
import { computeVelocitySkinningDeformation } from './VelocitySkinning.js';

var InteractiveSkeleton = function(object) {
    var self = this;
    self.object = object;
    self.mesh = self.object.mesh;
    if (self.object.filename.endsWith(".gltf") || self.object.filename.endsWith(".glb")) self.mesh = self.object.mesh.scene;
    self.animations = self.object.animations;
    self.skeletonMesh = new THREE.Group();
    self.mesh.attach(self.skeletonMesh);
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

    self.SKELETON_COLORS = {
        DEFAULT: new THREE.Color(0xFF00FF),
        SELECTED: new THREE.Color(0x00FFFF)
    }
    
    self.MODE = {
        MOVE: "move",
        ROTATE: "rotate"
    }

    self.TRANSFORM_MODE = self.MODE.MOVE;
    self.skeletonWidth = 2.5;

    self.velocity_skinning_data = [];
    
    self.angular_velocity_helper = new THREE.Mesh(new THREE.ConeBufferGeometry(0.01, 0.1, 4, 1), new THREE.MeshStandardMaterial({color: 0xFF0000}));
    self.angular_velocity_helper.material.depthTest = false;
    self.skeletonMesh.attach(self.angular_velocity_helper);
    self.angular_velocity_helper.matrixAutoUpdate = false;
    
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

        var createBoneMesh = function(mFromWorld, mToLocal, skeletonID) {
            var geometry = new THREE.ConeBufferGeometry(1, 1, 4, 1);
            geometry.translate(0, 0.5, 0);
            var boneColor = 0xFFFF00;
            if (parseInt(skeletonID) !== 1) {
                boneColor = 0xEE00EE;
            }
            var material = new THREE.MeshPhongMaterial({color: boneColor, transparent: true, opacity: 0.5});
            var boneMesh = new THREE.Mesh(geometry, material);
            boneMesh.material.depthTest = false;
            return boneMesh;
        }
        
        var jointGlobalMatrix = self.recalculateMatrix(jointMatrix, jointIndex);
        
        var finalJointRepr = [];
        var j = 0;
        for(var i = 0; i < jointMatrix.length; i++) {
            finalJointRepr.push(null);
        }
        for(var i = 0; i < jointMatrix.length; i++) {
            if(jointIndex[i] === -1) finalJointRepr[i] = createBoneMesh(jointGlobalMatrix[i], jointMatrix[i]);
            for(var j = 0; j < jointMatrix.length; j++) {
                if(jointIndex[i] === j) {
                    finalJointRepr[i] = createBoneMesh(jointGlobalMatrix[j], jointMatrix[i]);
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
        console.log(self.skeletonMesh);
    }

    self.updateRepr = function() {
        
        var reprBoneMatrixGlobal = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
        var updateBoneMesh = function(mFromWorld, mToWorld, boneMesh, scale) {
            boneMesh.matrix.identity();
            var jointGlobalPosition = new THREE.Vector3().setFromMatrixPosition(mToWorld);
            var parentGlobalPosition = new THREE.Vector3().setFromMatrixPosition(mFromWorld);
            var jointRelativePosition = new THREE.Vector3().subVectors(jointGlobalPosition, parentGlobalPosition);
            var boneLength = new THREE.Vector3().distanceTo(jointRelativePosition);
            if(boneLength < scale) boneLength = scale;
            var S = new THREE.Matrix4().makeScale(scale, boneLength, scale);
            jointRelativePosition.normalize();
            var R1 = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), jointRelativePosition));
            var T = new THREE.Matrix4().copyPosition(mFromWorld);
            boneMesh.matrix.copy(new THREE.Matrix4().multiplyMatrices(S, boneMesh.matrix));
            boneMesh.matrix.copy(new THREE.Matrix4().multiplyMatrices(R1, boneMesh.matrix));
            boneMesh.matrix.copy(new THREE.Matrix4().multiplyMatrices(T, boneMesh.matrix));
        }
        var jointGlobalMatrix = reprBoneMatrixGlobal;
        self.skeletonMesh.updateMatrixWorld(true);
        var skeletonMeshMatrix = self.skeletonMesh.matrixWorld.clone();
        var scale = new THREE.Vector3(0, self.skeletonWidth + 1, 0).applyMatrix4(skeletonMeshMatrix.clone().invert()).distanceTo(new THREE.Vector3(0, 1, 0).applyMatrix4(skeletonMeshMatrix.clone().invert()));
        for(var i = 0; i < jointGlobalMatrix.length; i++) {
            if(self.reprBoneIndex[i] === -1) updateBoneMesh(jointGlobalMatrix[i], jointGlobalMatrix[i], self.boneArray[i], scale);
            for(var j = 0; j < jointGlobalMatrix.length; j++) {
                if(self.reprBoneIndex[i] === j) {
                    updateBoneMesh(jointGlobalMatrix[j], jointGlobalMatrix[i], self.boneArray[i], scale);
                }
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
        self.rootJointMatrix = rootJoint.parent.matrixWorld.clone();
        self.createBoneRepr(self.reprBoneMatrix, self.reprBoneIndex);
        
        self.setSkeletonVisibility(false);
        self.prepareVSData();
    }

    self.raycast = function(mouse, objects, rendererDomElement, camera) {
        const rect = rendererDomElement.getBoundingClientRect();
        var pos = new THREE.Vector2((mouse.x - rect.left) / rect.width, (mouse.y - rect.top) / rect.height);
        var rayPos = new THREE.Vector2((pos.x * 2) - 1, - (pos.y * 2) + 1);
        self.raycaster.setFromCamera(rayPos, camera);
        return self.raycaster.intersectObjects(objects, true);
    }

    self.setSkeletonVisibility = function(visible) {
        for(var j in self.boneArray) {
            self.boneArray[j].visible = visible;
        }
    }

    self.setChildrenColor = function(index, color) {
        console.log("setting color");
        self.boneArray[index].material.color.copy(color);
        for(var j = 0; j < self.reprBoneIndex.length; j++) {
            if(self.reprBoneIndex[j] == index) {
                self.boneArray[j].material.color.copy(color);
                self.setChildrenColor(j, color);
                console.log("setting color after");
            }
        }
    }

    self.setSkeletonColor = function(color) {
        for(var j = 0; j < self.boneArray.length; j++) {
            self.boneArray[j].material.color.copy(color);
        }
    }

    self.select = function(mouse, rendererDomElement, camera) {
        var objectsToIntersect = self.skeletonMesh.children;
        var rayResult = self.raycast(mouse, objectsToIntersect, rendererDomElement, camera);
        if(rayResult.length > 0) {
            var selectedObject = rayResult[0].object;
            self.updateTransformSelection(selectedObject);
        }
    }

    self.updateTransformSelection = function(selectedObject) {
        var globalReprMatrix = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
        var jointIndex = self.retrieveReprBoneFromUUID(selectedObject.uuid);
        self.setSkeletonColor(self.SKELETON_COLORS.DEFAULT);
        self.setChildrenColor(jointIndex, self.SKELETON_COLORS.SELECTED);
        self.transformGroup.matrix.copy(globalReprMatrix[jointIndex]);
        var parentIndex = self.reprBoneIndex[jointIndex];
        var isOnlyChild = self.jointIsOnlyChild(jointIndex);
        console.log("parentIndex", parentIndex, "isOnlyChild", isOnlyChild);
        self.transformGroup.matrix.copy(globalReprMatrix[parentIndex]);
        self.transformGroupSub.position.set(0, 0, 0);
        self.transformGroupSub.rotation.set(0, 0, 0);
        self.transformGroupSub.scale.set(1, 1, 1);
        self.transformGroupSub.updateMatrix();
        
        self.boneControls.attach(self.transformGroupSub);
        self.selectedBone = {meshUUID: selectedObject.uuid, lastMatrix: self.transformGroupSub.matrix.clone().invert(), index: jointIndex};

        self.angular_velocity_helper.matrix.setPosition( new THREE.Vector3().setFromMatrixPosition(globalReprMatrix[parentIndex]));
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

    self.prepareVSData = function() {
        var models = [];
        for (var s in self.skeleton) {
            var model = {
                "velocity_skinning": {
                    "center_of_mass": [],
                    "vertex_depending_on_joint": [],
                    "vertex_weight_depending_on_joint": [],
                    "speed_tracker": [],
                    "rotation_tracker": [],
                    "matrix_tracker": []
                },
                "vertex_skinning": [],
                "skeleton_current": {
                    "position_global": self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex),
                    "position_local": [],
                    "rotation_global": [],
                    "rotation_local": []
                },
                "vertex_velocity_skinning": [],
                "velocity_skinning_deformation": [],
                "param": {
                    "flappy": 1,
                    "squashy": 1
                }
            }
            var globalJointMatrices = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
            
            for(var vertex = 0; vertex < self.initialPositions[s].count; vertex++) {
                model["vertex_skinning"].push(new THREE.Vector3().fromBufferAttribute(self.initialPositions[s], vertex));
                model["vertex_velocity_skinning"].push(new THREE.Vector3());
                model["velocity_skinning_deformation"].push(new THREE.Vector3());
            }


            for(var j = 0; j < self.reprBoneIndex.length; j++) {
                model["velocity_skinning"]["speed_tracker"].push({current_speed: new THREE.Vector3(), avg_speed: new THREE.Vector3()});
                model["velocity_skinning"]["rotation_tracker"].push({current_speed: new THREE.Vector3(), avg_speed: new THREE.Vector3(), last_position: new THREE.Quaternion()});
                model["skeleton_current"]["position_global"][j] = new THREE.Vector3().setFromMatrixPosition(model["skeleton_current"]["position_global"][j]);
                model["skeleton_current"]["position_local"].push(new THREE.Vector3().setFromMatrixPosition(self.reprBoneMatrix[j]));
                model["skeleton_current"]["rotation_local"].push(new THREE.Quaternion().setFromRotationMatrix(self.reprBoneMatrix[j]));
                model["skeleton_current"]["rotation_global"].push(new THREE.Quaternion().setFromRotationMatrix(globalJointMatrices[j]));
                model["velocity_skinning"]["center_of_mass"].push(new THREE.Vector3());
                model["velocity_skinning"]["matrix_tracker"].push(new THREE.Matrix4());
                model["velocity_skinning"]["vertex_depending_on_joint"].push([]);
                model["velocity_skinning"]["vertex_weight_depending_on_joint"].push([]);
            }

            var vertexVelocitySkinningWeights = [];
            var vertexVelocitySkinningJointsIdx = [];
            var startLog = 2000;
            var endLog = 2100;
            for(var Kvertex = 0; Kvertex < self.initialPositions[s].count; Kvertex++) {
                var vertexWeights = [];
                var vertexJointsIdx = [];
                var jointIndex = new THREE.Vector4().fromBufferAttribute(self.geometryAttributes[s].skinIndex, Kvertex);
                var jointWeight = new THREE.Vector4().fromBufferAttribute(self.geometryAttributes[s].skinWeight, Kvertex);
                for(var Kdependency = 0; Kdependency < 4; Kdependency++) {
                    if (jointWeight.getComponent(Kdependency) > 0) {
                        var currentBone = jointIndex.getComponent(Kdependency);
                        vertexWeights.push(jointWeight.getComponent(Kdependency));
                        vertexJointsIdx.push(currentBone);
                        model["velocity_skinning"]["vertex_depending_on_joint"][currentBone].push(Kvertex);
                        model["velocity_skinning"]["vertex_weight_depending_on_joint"][currentBone].push(jointWeight.getComponent(Kdependency));

                        currentBone = self.reprBoneIndex[currentBone];
                        while(currentBone != -1) {
                            if (vertexJointsIdx.includes(currentBone)) {
                                var tmp_boneIndex = vertexJointsIdx.indexOf(currentBone);
                                vertexWeights[tmp_boneIndex] += jointWeight.getComponent(Kdependency);
                            }
                            else {
                                vertexWeights.push(jointWeight.getComponent(Kdependency));
                                vertexJointsIdx.push(currentBone);
                            }

                            currentBone = self.reprBoneIndex[currentBone];
                        }
                    }
                }
                vertexVelocitySkinningWeights.push(vertexWeights);
                vertexVelocitySkinningJointsIdx.push(vertexJointsIdx);
                for(var Kj = 0; Kj < vertexJointsIdx; Kj++) {
                    var jointIdx = vertexJointsIdx[Kj];
                    model["velocity_skinning"]["vertex_depending_on_joint"][jointIdx].push(Kvertex);
                    model["velocity_skinning"]["vertex_weight_depending_on_joint"][jointIdx].push(vertexWeights[Kj]);
                }
                if(Kvertex >= startLog && Kvertex < endLog) {
                    console.log(Kvertex, vertexWeights, vertexJointsIdx);
                }
            }
            console.log("vertex joints:", model["velocity_skinning"]["vertex_weight_depending_on_joint"]);

            /*
            for(var j = 0; j < self.reprBoneIndex.length; j++) {
                var currentBone = self.reprBoneIndex[j];
                var previousBone = j;
                while(currentBone !== -1) {

                    
                    var previousWeights = model["velocity_skinning"]["vertex_weight_depending_on_joint"][previousBone];
                    for(var w = 0; w < previousWeights.length; w++) {
                        model["velocity_skinning"]["vertex_weight_depending_on_joint"][currentBone].push(previousWeights[w] + 1);
                        model["velocity_skinning"]["vertex_depending_on_joint"][currentBone].push(model["velocity_skinning"]["vertex_depending_on_joint"][previousBone][w]);
                    }
                    previousBone = currentBone;
                    currentBone = self.reprBoneIndex[currentBone];
                }
            }*/
            models.push(model);
        }
        self.velocity_skinning_data = models;
    }

    self.updateGeometryVS = function() {

        

        function quaternion_to_angular_speed(q, W) {
            W.set(q.x, q.y, q.z);
            const n = W.length();
            if(n<1e-6)
            {
                W.set(0,0,0);
            }
            else{
                const angle = 2 * Math.atan2(n, q.w);
                W.divideScalar(n);
                W.multiplyScalar(angle);
            }
        }
        function quaternion_via_axis_angle_to_angular_speed(q, W) {
            if(q.w > 1) q.normalize();
            var angle = 2 * Math.acos(q.w*(Math.PI / 180));
            var s = Math.sqrt(1-q.w*q.w);
            W.set(q.x, q.y, q.z);
            if (s >= 0.001) {
                W.divideScalar(s);
            }
            return W.multiplyScalar(angle);
        }

        var getLocalRotation = function(mFromFromWorld, mFromWorld, mToWorld) {
            var jointGlobalPosition = new THREE.Vector3().setFromMatrixPosition(mToWorld);
            var parentGlobalPosition = new THREE.Vector3().setFromMatrixPosition(mFromWorld);
            var parentParentGlobalPosition = new THREE.Vector3();
            if(mFromFromWorld !== undefined) parentParentGlobalPosition.setFromMatrixPosition(mFromFromWorld);
            var jointRelativePosition = new THREE.Vector3().subVectors(jointGlobalPosition, parentGlobalPosition).normalize();
            var parentRelativePosition = new THREE.Vector3().subVectors(parentGlobalPosition, parentParentGlobalPosition).normalize();

            return new THREE.Quaternion().setFromUnitVectors(parentRelativePosition, jointRelativePosition);
        }
        /*
        var computeLocalRotations = function(model, jointGlobalMatrix) {
            for(var i = 0; i < jointGlobalMatrix.length; i++) {
                if(self.reprBoneIndex[i] === -1) model["skeleton_current"]["rotation_local"][i].copy(getLocalRotation(new THREE.Matrix4(), new THREE.Matrix4(), jointGlobalMatrix[i]));
                else if(self.reprBoneMatrix[self.reprBoneMatrix[i]] === -1) model["skeleton_current"]["rotation_local"][i].copy(getLocalRotation(new THREE.Matrix4(), jointGlobalMatrix[self.reprBoneIndex[i]], jointGlobalMatrix[i]));
                else model["skeleton_current"]["rotation_local"][i].copy(getLocalRotation(jointGlobalMatrix[self.reprBoneIndex[self.reprBoneIndex[i]]], jointGlobalMatrix[self.reprBoneIndex[i]], jointGlobalMatrix[i]));
                //if(!oldRotation.equals(model["skeleton_current"]["rotation_local"][i])) console.log("joint:", i, "different", model["skeleton_current"]["rotation_local"][i]);
            }
        }*/
        
        var computeLocalRotations = function(jointGlobalMatrix) {
            var finalJointsQuaternions = [];
            for(var i = 0; i < jointGlobalMatrix.length; i++) {
                //var oldRotation = model["skeleton_current"]["rotation_local"][i].clone();
                var currentQuaternion = new THREE.Quaternion().setFromRotationMatrix(jointGlobalMatrix[i]);
                finalJointsQuaternions.push(currentQuaternion);
                //if(self.reprBoneIndex[i] === -1) var currentQuaternion = new THREE.Quaternion().setFromRotationMatrix(jointGlobalMatrix[i]);
                //else model["skeleton_current"]["rotation_local"][i].copy(getLocalRotation(jointGlobalMatrix[self.reprBoneIndex[self.reprBoneIndex[i]]], jointGlobalMatrix[self.reprBoneIndex[i]], jointGlobalMatrix[i]));
                //if(!oldRotation.equals(model["skeleton_current"]["rotation_local"][i])) console.log("joint:", i, "different", model["skeleton_current"]["rotation_local"][i]);
            }
            return finalJointsQuaternions;
        }
        /*
        var computeLocalRotations = function(jointGlobalMatrix) {
            var localQuaternions = [];
            for(var i = 0; i < jointGlobalMatrix.length; i++) {
                var currentQuaternion = new THREE.Quaternion();
                self.reprBoneMatrix[i].decompose(new THREE.Vector3(), currentQuaternion, new THREE.Vector3());
                currentQuaternion.normalize();
                localQuaternions.push(currentQuaternion);
            }
            return localQuaternions;
        }*/
        
        var computeGlobalRotations = function(boneIndex, localJointQuaternion) {
            var finalJointsQuaternions = [];
            for(var j = 0; j < boneIndex.length; j++) {
                finalJointsQuaternions.push(new THREE.Quaternion());
            }
            var currentBoneIndex = -1;
            var j = 0;
            while (j < boneIndex.length) {
                for(var b = 0; b < boneIndex.length; b++) {
                    if(boneIndex[b] === currentBoneIndex) {
                        if(currentBoneIndex !== -1) finalJointsQuaternions[b].multiplyQuaternions(finalJointsQuaternions[currentBoneIndex], localJointQuaternion[b]);
                        else finalJointsQuaternions[b].copy(localJointQuaternion[b]);
                        j++;
                    }
                }
                currentBoneIndex++;
            }
            return finalJointsQuaternions;
        }

        var getTransformationAngularVelocity = function(newMatrix, oldMatrix, globalParentMatrix) {
            var transform = new THREE.Matrix4().multiplyMatrices(newMatrix, oldMatrix.invert());
            transform.premultiply(globalParentMatrix);
            return new THREE.Vector3( - transform.elements[9], transform.elements[8], - transform.elements[4]);
        }

        //Construct model
        for(var skeletonIdx in self.skeleton) {
            var model = self.velocity_skinning_data[skeletonIdx];
            var globalJointMatrices = self.recalculateMatrix(self.reprBoneMatrix, self.reprBoneIndex);
            const R_parent = new THREE.Quaternion(0,0,0,1);
            for(var j = 0; j < self.reprBoneMatrix.length; j++) {

                const parent = self.reprBoneIndex[j];
                if (parent !== -1) var globalParentMatrix = globalJointMatrices[parent];
                else var globalParentMatrix = new THREE.Matrix4();
                var alpha = 0.80;
                model["velocity_skinning"]["speed_tracker"][j].current_speed.setFromMatrixPosition(self.reprBoneMatrix[j]).sub(model["skeleton_current"]["position_local"][j]).divideScalar(1/60.0).multiplyScalar(1-alpha);
                model["velocity_skinning"]["speed_tracker"][j].avg_speed.multiplyScalar(alpha).add(model["velocity_skinning"]["speed_tracker"][j].current_speed);

                var q0 = model["velocity_skinning"]["rotation_tracker"][j].last_position.clone();

                var localRotations = computeLocalRotations(globalJointMatrices);
                var globalRotations = computeGlobalRotations(self.reprBoneIndex, localRotations);

                var new_rotation_speed = new THREE.Quaternion().multiplyQuaternions(localRotations[j], q0.conjugate());

                //if(j==6) console.log("rotation current quaternion : ", model["skeleton_current"]["rotation_local"][j], "rotation last quaternion :", q0);

                const new_rotation_speed_vec = new THREE.Vector3();
                //quaternion_to_angular_speed(new_rotation_speed, new_rotation_speed_vec);
                new_rotation_speed_vec.copy(getTransformationAngularVelocity(self.reprBoneMatrix[j], model["velocity_skinning"]["matrix_tracker"][j], globalParentMatrix)).divideScalar(1/60.0);
                model["velocity_skinning"]["matrix_tracker"][j].copy(self.reprBoneMatrix[j]).premultiply(globalParentMatrix);
                //if(j==6) console.log(new_rotation_speed_vec)
                new_rotation_speed_vec.multiplyScalar(1-alpha);
                
                //if(!new_rotation_speed_vec.equals(new THREE.Vector3())) console.log("joint:", j, "moving with speed:", new_rotation_speed_vec);

                model["velocity_skinning"]["rotation_tracker"][j].avg_speed.multiplyScalar(alpha);
                model["velocity_skinning"]["rotation_tracker"][j].avg_speed.add(new_rotation_speed_vec);


                model["velocity_skinning"]["rotation_tracker"][j].last_position.copy(localRotations[j]);


                if (parent !== -1) R_parent.copy(globalRotations[parent]);
                model["velocity_skinning"]["speed_tracker"][j].current_speed.copy(model["velocity_skinning"]["speed_tracker"][j].avg_speed).multiplyScalar(1);
                //model["velocity_skinning"]["speed_tracker"][j].current_speed.applyQuaternion(R_parent);

                //model["velocity_skinning"]["rotation_tracker"][j].current_speed.copy(new_rotation_speed_vec).applyQuaternion(R_parent);
                model["velocity_skinning"]["rotation_tracker"][j].current_speed.copy(model["velocity_skinning"]["rotation_tracker"][j].avg_speed).multiplyScalar(1);
                //model["velocity_skinning"]["rotation_tracker"][j].current_speed.applyQuaternion(R_parent);
                if(self.selectedBone !== undefined && j == self.selectedBone.index) {
                    var tmp_position = new THREE.Vector3().setFromMatrixPosition(self.angular_velocity_helper.matrix);
                    var scale = model["velocity_skinning"]["rotation_tracker"][j].current_speed.length()*10;
                    //self.angular_velocity_helper.matrix.lookAt(new THREE.Vector3(), model["velocity_skinning"]["rotation_tracker"][j].current_speed.clone().normalize(), new THREE.Vector3(0, 1, 0)).premultiply(new THREE.Matrix4().makeScale(scale, scale, scale)).setPosition(tmp_position);
                    //console.log("scale:", scale);
                    //self.angular_velocity_helper.scale.set(scale, scale, scale);
                }

                //if(!model["velocity_skinning"]["speed_tracker"][j].current_speed.equals(new THREE.Vector3(0, 0, 0))) console.log("joint:", j, " - speed:", model["velocity_skinning"]["speed_tracker"][j].current_speed);

                model["skeleton_current"]["position_global"][j].setFromMatrixPosition(globalJointMatrices[j]);
                model["skeleton_current"]["position_local"][j].setFromMatrixPosition(self.reprBoneMatrix[j]);
            }
            model["skeleton_current"]["rotation_local"] = computeLocalRotations(globalJointMatrices);
            model["skeleton_current"]["rotation_global"] = computeGlobalRotations(self.reprBoneIndex, model["skeleton_current"]["rotation_local"]);
        }
        computeVelocitySkinningDeformation(model);
        for(var Kvertex = 0; Kvertex < self.geometryAttributes[skeletonIdx].position.count; Kvertex++) {
            self.geometryAttributes[skeletonIdx].position.array[Kvertex*3] += model["velocity_skinning_deformation"][Kvertex].x;
            self.geometryAttributes[skeletonIdx].position.array[Kvertex*3 + 1] += model["velocity_skinning_deformation"][Kvertex].y;
            self.geometryAttributes[skeletonIdx].position.array[Kvertex*3 + 2] += model["velocity_skinning_deformation"][Kvertex].z;
        }
    }

    self.retrieveReprBoneFromUUID = function(uuid) {
        for(var j in self.boneArray) {
            if(self.boneArray[j].uuid === uuid) return j;
        }
        console.log(uuid, "not found in bones uuid");
    }

    self.jointIsOnlyChild = function(jointIndex) {
        var parentRefOccurences = 0;
        for(var j = 0; j < self.reprBoneIndex.length; j++) {
            if (self.reprBoneIndex[j] === self.reprBoneIndex[jointIndex]) parentRefOccurences++;
        }
        return parentRefOccurences <= 1;
    }

    self.applyTransform = function() {
        if(self.selectedBone !== undefined) {
            var transformMatrix = new THREE.Matrix4();
            var boneIndex = self.retrieveReprBoneFromUUID(self.selectedBone.meshUUID);
            transformMatrix.multiplyMatrices(self.transformGroupSub.matrix, self.selectedBone.lastMatrix);
            
            //if(self.TRANSFORM_MODE = self.MODE.ROTATE) {
                var parentIndex = self.reprBoneIndex[boneIndex];
                if(!self.jointIsOnlyChild(boneIndex)) {
                    var oldJointMatrix = self.reprBoneMatrix[boneIndex].clone();
                    var updateMatrix = new THREE.Matrix4().multiplyMatrices(transformMatrix, oldJointMatrix);
                    oldJointMatrix.invert();
                    var finalTransformMatrix = new THREE.Matrix4().multiplyMatrices(updateMatrix, oldJointMatrix);
                    self.reprBoneMatrix[boneIndex].copy(new THREE.Matrix4().multiplyMatrices(transformMatrix, self.reprBoneMatrix[boneIndex]));
                } else {
                    if(parentIndex !== -1) self.reprBoneMatrix[parentIndex].multiply(transformMatrix);
                    else self.reprBoneMatrix[boneIndex].multiply(transformMatrix);
                }
            /*} else {
                self.reprBoneMatrix[boneIndex].multiply(transformMatrix);
            }*/
            self.selectedBone.lastMatrix.copy(self.transformGroupSub.matrix).invert();
        }
    }

    self.onAfterInteraction = function(mouse) {
        self.updateTransformSelection(self.boneArray[boneIndex]);
    }

    self.tick = function(boneControls) {
        self.setSkeletonVisibility(true);
        self.boneControls = boneControls;
        
        self.applyTransform();
        self.updateRepr();

        self.updateGeometry();
        self.updateGeometryVS();

    }
    self.init();
}

export {InteractiveSkeleton};