import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../jsm/controls/TransformControls.js';

var InteractiveSkeleton = function(object) {
    var self = this;
    self.object = object;
    self.mesh = self.object.mesh;
    self.animations = self.object.animations;
    self.objectBones = [];
    self.bonesMesh = [];
    self.raycaster = new THREE.Raycaster();
    self.boneControls;
    self.boneMap = {};
    self.selectedBone;
    self.skeleton;

    self.init = function() {
        self.mesh.traverse(function(child) {
            if ( child.isMesh ) {
				if (child.skeleton) {
					console.log(child.skeleton);
                    self.skeleton = child.skeleton;
                    self.objectBones.push({"child": child, "bones": child.skeleton.bones});
				}
			}
        });

        var createBoneMesh = function(vFrom, vTo) {
            var from = new THREE.Vector3();
            var to = new THREE.Vector3();
            vFrom.getWorldPosition(from);
            vTo.getWorldPosition(to);
            var geometry = new THREE.ConeBufferGeometry(1, 1, 4, 1);
            geometry.rotateX(Math.PI/2);
            geometry.translate(0, 0, 0.5);

            var material = new THREE.MeshBasicMaterial({color: 0xffff00});
            var boneMesh = new THREE.Mesh(geometry, material);
            boneMesh.position.setFromMatrixPosition(vFrom.matrixWorld);
            boneMesh.updateMatrixWorld(true);
            var targetPos = new THREE.Vector3();
            targetPos.setFromMatrixPosition(vTo.matrixWorld);
            boneMesh.lookAt(targetPos);
            boneMesh.updateMatrixWorld(true);
            boneMesh.scale.set(1, 1, from.distanceTo(to));

            return boneMesh;
        }

        for(var i in self.objectBones) {
            for(var bone in self.objectBones[i]["bones"]) {
                console.log(self.objectBones[i]["bones"][bone]);
                var vertexFrom = self.objectBones[i]["bones"][bone];
                for(var child in self.objectBones[i]["bones"][bone].children) {
                    var vertexTo = self.objectBones[i]["bones"][bone].children[child];
                    vertexFrom.updateMatrixWorld(true);
                    vertexTo.updateMatrixWorld(true);
                    var boneMesh = createBoneMesh(vertexFrom, vertexTo);
                    self.mesh.attach(boneMesh);
                    self.bonesMesh.push(boneMesh);
                    self.boneMap[boneMesh.uuid] = vertexFrom;
                }
            }
        }
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
        var objectsToIntersect = self.bonesMesh;
        var rayResult = self.raycast(mouse, objectsToIntersect, rendererDomElement, camera);
        console.log(rayResult);
        if(rayResult.length > 0) {
            var selectedObject = rayResult[0].object;
            self.boneControls.attach(selectedObject);
            self.selectedBone = selectedObject;
        }
    }


    self.tick = function(boneControls) {
        self.boneControls = boneControls;
        if(self.selectedBone !== undefined) {
            //self.selectedBone.updateMatrixWorld(true);
            self.boneMap[self.selectedBone.uuid].rotation.copy(self.selectedBone.rotation);
            //console.log("here comes the matrix (world) : ", self.selectedBone.matrixWorld);
            //self.boneMap[self.selectedBone.uuid].updateMatrixWorld(true);
            //self.skeleton.update();
        }
        /*
        for(var i in self.objectBones) {
            for(var bone in self.objectBones[i]["bones"]) {
                for(var child in self.objectBones[i]["bones"][bone].children) {
                    //if(self.objectBones[i]["bones"][bone].children[child].isMesh) self.objectBones[i]["bones"][bone].children[child].applyMatrix4(self.objectBones[i]["bones"][bone].matrixWorld);
                }
            }
        }*/
    }
}

export {InteractiveSkeleton};