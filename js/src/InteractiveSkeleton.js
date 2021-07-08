import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../jsm/controls/TransformControls.js';
import { computeVelocitySkinningDeformation } from './VelocitySkinning.js';
import { VertexMotionHelper } from './VertexMotionHelper.js';

var InteractiveSkeleton = function(skinnedMesh, skeleton) {
    var self = this;
    self.skinnedMesh = skinnedMesh;
    self.skeleton = skeleton;
    self.skeletonMesh = new THREE.Group();
    self.skinnedMesh.attach(self.skeletonMesh);
    self.skeletonMesh.matrixAutoUpdate = false;
    self.raycaster = new THREE.Raycaster();
    self.boneControls;
    self.boneMap = [];
    self.boneArray = [];
    self.selectedBone;

    self.joints = [];

    self.geometryAttributes = [];
    self.initialPositions = [];

    self.currentMatrices = [];
    self.initialMatricesInverse = [];

    self.parentJointIndices = [];

    self.boneToJointIndices = [];

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
    
    self.angular_velocity_helper = new THREE.Mesh(new THREE.CylinderBufferGeometry( 1, 1, 5, 32 ), new THREE.MeshStandardMaterial({color: 0xFF0000}));
    self.angular_velocity_helper.geometry.translate(0, 2.5, 0);
    var helper_cone = new THREE.Mesh(new THREE.ConeBufferGeometry( 1.5, 2, 32 ), new THREE.MeshStandardMaterial({color: 0xFF0000}));
    helper_cone.material.depthTest = false;
    self.angular_velocity_helper.add(helper_cone);
    helper_cone.position.set(0, 5, 0);
    self.angular_velocity_helper.material.depthTest = false;

    self.VertexMotionHelper = new VertexMotionHelper();


    self.recalculateMatrix = function(joints) {
        for(var j = 0; j < joints.length; j++) {
            if(joints[j].parentIndex == -1) joints[j].matrixWorld.copy(joints[j].matrix);
            else joints[j].matrixWorld.multiplyMatrices(joints[joints[j].parentIndex].matrixWorld, joints[j].matrix);
        }
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


    self.createBoneRepr = function(joints) {

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
        
        for(var i = 0; i < joints.length; i++) {
            if(joints[i].parentIndex === -1) joints[i].jointGroup = createBoneMesh(joints[i].matrixWorld, joints[i].matrix);
            for(var j = 0; j < joints.length; j++) {
                if(joints[i].parentIndex === j) {
                    joints[i].jointGroup = createBoneMesh(joints[j].matrixWorld, joints[i].matrix);
                }
            }
            joints[i].jointGroup.matrixAutoUpdate = false;
            self.skeletonMesh.attach(joints[i].jointGroup);
        }
        
        console.log(joints);
        
    }

    self.updateRepr = function() {
        
        self.recalculateMatrix(self.joints);
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
        self.skeletonMesh.updateMatrixWorld(true);
        var skeletonMeshMatrix = self.skeletonMesh.matrixWorld.clone();
        var scale = new THREE.Vector3(0, self.skeletonWidth + 1, 0).applyMatrix4(skeletonMeshMatrix.clone().invert()).distanceTo(new THREE.Vector3(0, 1, 0).applyMatrix4(skeletonMeshMatrix.clone().invert()));
        for(var i = 0; i < self.joints.length; i++) {
            if(self.joints[i].parentIndex === -1) updateBoneMesh(self.joints[i].matrixWorld, self.joints[i].matrixWorld, self.joints[i].jointGroup, scale);
            for(var j = 0; j < self.joints.length; j++) {
                if(self.joints[i].parentIndex === j) {
                    updateBoneMesh(self.joints[j].matrixWorld, self.joints[i].matrixWorld, self.joints[i].jointGroup, scale);
                }
            }
        }
    }

    self.init = function() {
        self.geometryAttributes = self.skinnedMesh.geometry.attributes;
        

        var getRoot = function(child) {
            if(child.parent && child.parent.isBone) return getRoot(child.parent);
            return child;
        }
        var rootJoint = getRoot(self.skeleton.bones[0]);
        var jointArray = [rootJoint];
        var indexJointRecursive = function(parentJoint) {
            for(var c in parentJoint.children) {
                jointArray.push(parentJoint.children[c]);
                indexJointRecursive(parentJoint.children[c]);
            }
        }
        indexJointRecursive(rootJoint);

        var retrieveSkeletonIndexFromBoneObject = function(skeleton, bone) {
            for(var b = 0; b < skeleton.bones.length; b++) {
                if(skeleton.bones[b].uuid === bone.uuid) return b;
            }
            return -1;
        }

        self.initialPositions = self.geometryAttributes.position.clone();
        
        var jointObjects = [];
        for (var j in jointArray) {
            var jointObject = {
                matrix: jointArray[j].matrix.clone(),
                index: retrieveSkeletonIndexFromBoneObject(self.skeleton, jointArray[j]),
                boneObject: jointArray[j],
                matrixWorld: new THREE.Matrix4(),
            };
            jointObjects.push(jointObject);
        }

        var setParentIndexToJointObjects = function(jointObjects) {
            for(var j = 0; j < jointObjects.length; j++) {
                var jp = 0;
                while(jp < jointObjects.length && jointObjects[jp].boneObject.uuid !== jointObjects[j].boneObject.parent.uuid) {
                    jp++;
                }
                if(jp === jointObjects.length) {
                    jp = -1;
                }
                jointObjects[j].parentIndex = jp;
            }
        }
        

        setParentIndexToJointObjects(jointObjects);
        self.rootJointMatrix = rootJoint.parent.matrixWorld.clone();
        self.createBoneRepr(jointObjects);
        
        self.joints = jointObjects;

        self.recalculateMatrix(self.joints);

        for(var b = 0; b < self.skeleton.bones.length; b++) {
            var j = 0;
            while(self.joints[j].index !== b) {
                j++;
            }
            self.currentMatrices.push(self.joints[j].matrixWorld);
            self.initialMatricesInverse.push(self.joints[j].matrixWorld.clone().invert());
            self.boneToJointIndices.push(j);
            var bp = 0;
            while(bp < self.skeleton.bones.length && self.skeleton.bones[bp].uuid !== self.skeleton.bones[b].parent.uuid) {
                bp++;
            }
            if(bp === self.skeleton.bones.length) {
                bp = -1;
            }
            self.parentJointIndices.push(bp);
        }
        self.setSkeletonVisibility(false);
        self.prepareVSData();
        
        //self.skeletonMesh.attach(self.angular_velocity_helper);
        console.log(self.boneToJointIndices);
        var skeletonMeshMatrix = new THREE.Matrix4();
        self.skeletonMesh.matrix.copy(skeletonMeshMatrix.multiplyMatrices(self.rootJointMatrix, self.skinnedMesh.matrixWorld.clone().invert()));
    }

    self.raycast = function(mouse, objects, rendererDomElement, camera) {
        const rect = rendererDomElement.getBoundingClientRect();
        var pos = new THREE.Vector2((mouse.x - rect.left) / rect.width, (mouse.y - rect.top) / rect.height);
        var rayPos = new THREE.Vector2((pos.x * 2) - 1, - (pos.y * 2) + 1);
        self.raycaster.setFromCamera(rayPos, camera);
        return self.raycaster.intersectObjects(objects, true);
    }

    self.setSkeletonVisibility = function(visible) {
        for(var j in self.joints) {
            self.joints[j].jointGroup.visible = visible;
        }
    }

    self.setChildrenColor = function(index, color) {
        console.log("setting color for", index);
        self.joints[index].jointGroup.material.color.copy(color);
        for(var j = 0; j < self.joints.length; j++) {
            if(self.joints[j].parentIndex == index) {
                self.joints[j].jointGroup.material.color.copy(color);
                self.setChildrenColor(j, color);
                console.log("setting color after");
            }
        }
    }

    self.setSkeletonColor = function(color) {
        for(var j = 0; j < self.joints.length; j++) {
            self.joints[j].jointGroup.material.color.copy(color);
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
        self.recalculateMatrix(self.joints);
        var jointIndex = self.retrieveJointObjectFromBoneObject(selectedObject);
        var joint = self.joints[jointIndex];
        self.setSkeletonColor(self.SKELETON_COLORS.DEFAULT);
        self.setChildrenColor(jointIndex, self.SKELETON_COLORS.SELECTED);
        self.transformGroup.matrix.copy(joint.matrixWorld);
        var parentIndex = joint.parentIndex;
        var isOnlyChild = self.jointIsOnlyChild(jointIndex);
        console.log("parentIndex", parentIndex, "isOnlyChild", isOnlyChild);
        self.transformGroup.matrix.copy(self.joints[parentIndex].matrixWorld);
        self.transformGroupSub.position.set(0, 0, 0);
        self.transformGroupSub.rotation.set(0, 0, 0);
        self.transformGroupSub.scale.set(1, 1, 1);
        self.transformGroupSub.updateMatrix();
        
        self.boneControls.attach(self.transformGroupSub);
        self.selectedBone = {joint: joint, lastMatrix: self.transformGroupSub.matrix.clone().invert()};

        self.angular_velocity_helper.position.setFromMatrixPosition(self.joints[parentIndex].matrixWorld);
    }

    self.updateGeometry = function() {

        var M = new THREE.Matrix4();
        var Mf = new THREE.Matrix4();
        var vertexPosition = new THREE.Vector3();
        //TODO : replace Vec4 with array to store more weights if needed
        var boneIndex = new THREE.Vector4();
        var boneWeight = new THREE.Vector4();
        var vertexPositionsAttribute = self.initialPositions;
        var vertexIndexAttribute = self.geometryAttributes.skinIndex;
        var boneWeightAttribute = self.geometryAttributes.skinWeight;
        var vertexCount = vertexPositionsAttribute.count;
        var outputVertexArray = self.geometryAttributes.position.array;

        self.recalculateMatrix(self.joints);
        var reprBoneMatrixWorld = self.currentMatrices;
        var threejsBoneMatrixWorld_inv = self.initialMatricesInverse;

        for(var Kvertex = 0; Kvertex < vertexCount; Kvertex++) {
            boneIndex.fromBufferAttribute(vertexIndexAttribute, Kvertex);
            boneWeight.fromBufferAttribute(boneWeightAttribute, Kvertex);

            vertexPosition.fromBufferAttribute(vertexPositionsAttribute, Kvertex);

            Mf.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
            
            //TODO : use the item size of vertexIndexAttribute to use the following loop (4 is constant but should be replaced)
            for(var Kdependency = 0; Kdependency < 4; Kdependency++) {

                var i = boneIndex.getComponent(Kdependency);
                var T = reprBoneMatrixWorld[i];
                var T0_inv = threejsBoneMatrixWorld_inv[i];
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
        self.geometryAttributes.position.needsUpdate = true;
        
    }

    self.prepareVSData = function() {
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
                "position_global": [],
                "position_local": [],
                "rotation_global": [],
                "rotation_local": []
            },
            "vertex_velocity_skinning": [],
            "velocity_skinning_deformation": [],
            "param": {
                "flappy": 1,
                "squashy": 0
            }
        }
        self.recalculateMatrix(self.joints);
        
        for (var vertex = 0; vertex < self.initialPositions.count; vertex++) {
            model["vertex_skinning"].push(new THREE.Vector3().fromBufferAttribute(self.initialPositions, vertex));
            model["vertex_velocity_skinning"].push(new THREE.Vector3());
            model["velocity_skinning_deformation"].push(new THREE.Vector3());
        }


        for (var j = 0; j < self.skeleton.bones.length; j++) {
            model["velocity_skinning"]["speed_tracker"].push({current_speed: new THREE.Vector3(), avg_speed: new THREE.Vector3()});
            model["velocity_skinning"]["rotation_tracker"].push({current_speed: new THREE.Vector3(), avg_speed: new THREE.Vector3(), last_position: new THREE.Quaternion()});
            model["skeleton_current"]["position_global"].push(new THREE.Vector3().setFromMatrixPosition(self.joints[self.boneToJointIndices[j]].matrixWorld));
            model["skeleton_current"]["position_local"].push(new THREE.Vector3().setFromMatrixPosition(self.joints[self.boneToJointIndices[j]].matrix));
            model["skeleton_current"]["rotation_local"].push(new THREE.Quaternion().setFromRotationMatrix(self.joints[self.boneToJointIndices[j]].matrix));
            model["skeleton_current"]["rotation_global"].push(new THREE.Quaternion().setFromRotationMatrix(self.joints[self.boneToJointIndices[j]].matrixWorld));
            model["velocity_skinning"]["center_of_mass"].push(new THREE.Vector3());
            model["velocity_skinning"]["matrix_tracker"].push(new THREE.Matrix4());
            model["velocity_skinning"]["vertex_depending_on_joint"].push([]);
            model["velocity_skinning"]["vertex_weight_depending_on_joint"].push([]);
        }

        var vertexVelocitySkinningWeights = [];
        var vertexVelocitySkinningJointsIdx = [];
        for(var Kvertex = 0; Kvertex < self.initialPositions.count; Kvertex++) {
            var vertexWeights = [];
            var vertexJointsIdx = [];
            var jointIndex = new THREE.Vector4().fromBufferAttribute(self.geometryAttributes.skinIndex, Kvertex);
            var jointWeight = new THREE.Vector4().fromBufferAttribute(self.geometryAttributes.skinWeight, Kvertex);
            for(var Kdependency = 0; Kdependency < 4; Kdependency++) {
                if (jointWeight.getComponent(Kdependency) > 0) {
                    var currentBone = jointIndex.getComponent(Kdependency);
                    vertexWeights.push(jointWeight.getComponent(Kdependency));
                    vertexJointsIdx.push(currentBone);
                    model["velocity_skinning"]["vertex_depending_on_joint"][currentBone].push(Kvertex);
                    model["velocity_skinning"]["vertex_weight_depending_on_joint"][currentBone].push(jointWeight.getComponent(Kdependency));
                    currentBone = self.parentJointIndices[currentBone];
                    while(currentBone != -1) {
                        if (vertexJointsIdx.includes(currentBone)) {
                            var tmp_boneIndex = vertexJointsIdx.indexOf(currentBone);
                            vertexWeights[tmp_boneIndex] += jointWeight.getComponent(Kdependency);
                        }
                        else {
                            vertexWeights.push(jointWeight.getComponent(Kdependency));
                            vertexJointsIdx.push(currentBone);
                        }

                        currentBone = self.parentJointIndices[currentBone];
                    }
                }
            }
            vertexVelocitySkinningWeights.push(vertexWeights);
            vertexVelocitySkinningJointsIdx.push(vertexJointsIdx);
            for(var Kj = 0; Kj < vertexJointsIdx.length; Kj++) {
                var jointIdx = vertexJointsIdx[Kj];
                model["velocity_skinning"]["vertex_depending_on_joint"][jointIdx].push(Kvertex);
                model["velocity_skinning"]["vertex_weight_depending_on_joint"][jointIdx].push(vertexWeights[Kj]);
            }
        }
        self.velocity_skinning_data = model;
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
        
        var computeLocalRotations = function() {
            var localQuaternions = [];
            for(var i = 0; i < self.joints.length; i++) {
                var currentQuaternion = new THREE.Quaternion();
                self.joints[i].matrix.decompose(new THREE.Vector3(), currentQuaternion, new THREE.Vector3());
                localQuaternions.push(currentQuaternion);
            }
            return localQuaternions;
        }

        var decomposeGlobalRotations = function() {
            var localQuaternions = [];
            for(var i = 0; i < self.joints.length; i++) {
                var currentQuaternion = new THREE.Quaternion();
                self.joints[i].matrixWorld.decompose(new THREE.Vector3(), currentQuaternion, new THREE.Vector3());
                localQuaternions.push(currentQuaternion);
            }
            return localQuaternions;
        }
        
        var computeGlobalRotations = function(localJointQuaternion) {
            var finalJointsQuaternions = [];
            for(var j = 0; j < self.joints.length; j++) {
                finalJointsQuaternions.push(new THREE.Quaternion());
            }
            for(var b = 0; b < self.joints.length; b++) {
                if(self.joints[b].parentIndex !== -1) finalJointsQuaternions[b].multiplyQuaternions(finalJointsQuaternions[self.joints[b].parentIndex], localJointQuaternion[b]);
                else finalJointsQuaternions[b].copy(localJointQuaternion[b]);
            }
            return finalJointsQuaternions;
        }

        var transformDirection = function(vec, m ) {

            // input: THREE.Matrix4 affine matrix
            // vector interpreted as a direction
    
            const x = vec.x, y = vec.y, z = vec.z;
            const e = m.elements;
    
            vec.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z;
            vec.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z;
            vec.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z;
    
            return vec;
    
        }

        //Construct model
        var model = self.velocity_skinning_data;
        self.recalculateMatrix(self.joints);
        const R_parent = new THREE.Quaternion(0,0,0,1);
        const M_parent = new THREE.Matrix4();
        var localRotations = computeLocalRotations();
        var globalRotations = decomposeGlobalRotations();
        //console.log(globalRotations);
        for(var b = 0; b < self.skeleton.bones.length; b++) {
            var j = self.boneToJointIndices[b];

            var bparent = self.parentJointIndices[b];
            if (bparent == -1) var parent = -1;
            else var parent = self.boneToJointIndices[bparent];
            
            if (parent !== -1) {
                R_parent.copy(globalRotations[parent]);
                M_parent.copy(self.joints[parent].matrixWorld);
            }

            var alpha = 0.90;
            model["velocity_skinning"]["speed_tracker"][b].current_speed.setFromMatrixPosition(self.joints[j].matrix).sub(model["skeleton_current"]["position_local"][b]).divideScalar(1/60.0).multiplyScalar(1-alpha);
            model["velocity_skinning"]["speed_tracker"][b].avg_speed.multiplyScalar(alpha).add(model["velocity_skinning"]["speed_tracker"][b].current_speed);

            var q0 = model["velocity_skinning"]["rotation_tracker"][b].last_position.clone();

            
            var new_rotation_speed = new THREE.Quaternion().copy(localRotations[j]);
            if(new_rotation_speed.dot(q0) < 0) new_rotation_speed.set(- new_rotation_speed.x, - new_rotation_speed.y, - new_rotation_speed.z, - new_rotation_speed.w);
            model["velocity_skinning"]["rotation_tracker"][b].last_position.copy(new_rotation_speed);
            new_rotation_speed.multiply(q0.conjugate());

            const new_rotation_speed_vec = new THREE.Vector3();
            quaternion_to_angular_speed(new_rotation_speed, new_rotation_speed_vec);
            new_rotation_speed_vec.multiplyScalar(1-alpha).divideScalar(1/60.0);
            

            model["velocity_skinning"]["rotation_tracker"][b].avg_speed.multiplyScalar(alpha);
            model["velocity_skinning"]["rotation_tracker"][b].avg_speed.add(new_rotation_speed_vec);

            model["velocity_skinning"]["speed_tracker"][b].current_speed.copy(model["velocity_skinning"]["speed_tracker"][b].avg_speed).multiplyScalar(1);
            model["velocity_skinning"]["speed_tracker"][b].current_speed.applyQuaternion(R_parent);

            
            model["velocity_skinning"]["rotation_tracker"][b].current_speed.copy(model["velocity_skinning"]["rotation_tracker"][b].avg_speed).multiplyScalar(1);
            model["velocity_skinning"]["rotation_tracker"][b].current_speed.applyQuaternion(R_parent);
            /*
            if(self.joints[j].parentIndex != -1) {
                //var globalRotation = new THREE.Vector4(model["velocity_skinning"]["rotation_tracker"][b].current_speed.x, model["velocity_skinning"]["rotation_tracker"][b].current_speed.y, model["velocity_skinning"]["rotation_tracker"][b].current_speed.z, 0).applyMatrix4(self.joints[self.joints[j].parentIndex].matrixWorld);
                //model["velocity_skinning"]["rotation_tracker"][b].current_speed.set(globalRotation.x, globalRotation.y, globalRotation.z);
                model["velocity_skinning"]["rotation_tracker"][b].current_speed.copy(transformDirection(model["velocity_skinning"]["rotation_tracker"][b].current_speed, self.joints[self.joints[j].parentIndex].matrixWorld));
                //console.log(globalRotation);
            }*/


            if(self.selectedBone !== undefined && b == self.selectedBone.joint.index) {
                //var tmp_position = new THREE.Vector3().setFromMatrixPosition(self.angular_velocity_helper.matrix);
                var scale = model["velocity_skinning"]["rotation_tracker"][b].current_speed.length()*0.1;
                //self.angular_velocity_helper.matrix.lookAt(new THREE.Vector3(), model["velocity_skinning"]["rotation_tracker"][j].current_speed.clone().normalize(), new THREE.Vector3(0, 1, 0)).premultiply(new THREE.Matrix4().makeScale(scale, scale, scale)).setPosition(tmp_position);
                console.log("scale:", j, scale);
                self.angular_velocity_helper.scale.y = scale;
                self.angular_velocity_helper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), model["velocity_skinning"]["rotation_tracker"][b].current_speed.clone().normalize());
            }

            model["skeleton_current"]["position_global"][b].setFromMatrixPosition(self.joints[j].matrixWorld);
            model["skeleton_current"]["position_local"][b].setFromMatrixPosition(self.joints[j].matrix);
        }
        model["skeleton_current"]["rotation_local"] = computeLocalRotations();
        model["skeleton_current"]["rotation_global"] = decomposeGlobalRotations();
        computeVelocitySkinningDeformation(model);
        for(var Kvertex = 0; Kvertex < self.geometryAttributes.position.count; Kvertex++) {
            self.geometryAttributes.position.array[Kvertex*3] += model["velocity_skinning_deformation"][Kvertex].x;
            self.geometryAttributes.position.array[Kvertex*3 + 1] += model["velocity_skinning_deformation"][Kvertex].y;
            self.geometryAttributes.position.array[Kvertex*3 + 2] += model["velocity_skinning_deformation"][Kvertex].z;
        }
        self.VertexMotionHelper.update(self.geometryAttributes.position.array);
    }
    self.retrieveJointObjectFromBoneObject = function(boneObject) {
        for (var j = 0; j < self.joints.length; j++) {
            if(boneObject.uuid == self.joints[j].jointGroup.uuid) return j;
        }
        console.log(boneObject, "not found in joint bone objects uuid", self.joints);
    }

    self.jointIsOnlyChild = function(joint) {
        var parentRefOccurences = 0;
        for(var j = 0; j < self.joints.length; j++) {
            if (self.joints[j].parentIndex === joint.parentIndex) parentRefOccurences++;
        }
        return parentRefOccurences <= 1;
    }

    self.applyTransform = function() {
        if(self.selectedBone !== undefined) {
            var transformMatrix = new THREE.Matrix4();
            var joint = self.selectedBone.joint;
            transformMatrix.multiplyMatrices(self.transformGroupSub.matrix, self.selectedBone.lastMatrix);
            
            //if(self.TRANSFORM_MODE = self.MODE.ROTATE) {
                var parentIndex = joint.parentIndex;
                if(!self.jointIsOnlyChild(joint)) {
                    var oldJointMatrix = joint.matrix.clone();
                    var updateMatrix = new THREE.Matrix4().multiplyMatrices(transformMatrix, oldJointMatrix);
                    oldJointMatrix.invert();
                    var finalTransformMatrix = new THREE.Matrix4().multiplyMatrices(updateMatrix, oldJointMatrix);
                    joint.matrix.copy(new THREE.Matrix4().multiplyMatrices(transformMatrix, joint.matrix));
                } else {
                    if(parentIndex !== -1) self.joints[joint.parentIndex].matrix.multiply(transformMatrix);
                    else joint.matrix.multiply(transformMatrix);
                }
            /*} else {
                self.reprBoneMatrix[boneIndex].multiply(transformMatrix);
            }*/
            self.selectedBone.lastMatrix.copy(self.transformGroupSub.matrix).invert();
        }
    }

    self.onAfterInteraction = function(mouse) {
        //self.updateTransformSelection(self.boneArray[boneIndex]);
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