import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../jsm/controls/TransformControls.js';

var InteractiveSkeleton = function(object) {
    var self = this;
    self.object = object;
    self.mesh = self.object.mesh;
    self.animations = self.object.animations;
    self.transformControls = 
    self.objectBones = [];

    self.init = function() {
        self.mesh.traverse(function(child) {
            if ( child.isMesh ) {
				if (child.skeleton) {
					console.log(child.skeleton);
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
            geometry.rotateX(- Math.PI/2);
            var boneLength = from.distanceTo(to);
            geometry.translate(0, 0, 0.5);

            var material = new THREE.MeshBasicMaterial({color: 0xffff00});
            var boneMesh = new THREE.Mesh(geometry, material);
            boneMesh.position.setFromMatrixPosition(vTo.matrixWorld);
            boneMesh.updateMatrixWorld(true);
            var targetPos = new THREE.Vector3();
            targetPos.setFromMatrixPosition(vFrom.matrixWorld);
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
                    self.mesh.attach(createBoneMesh(vertexFrom, vertexTo));
                }
            }
        }
    }
    self.init();

    self.tick = function() {
        for(var i in self.objectBones) {
            for(var bone in self.objectBones[i]["bones"]) {
                for(var child in self.objectBones[i]["bones"][bone].children) {
                    //if(self.objectBones[i]["bones"][bone].children[child].isMesh) self.objectBones[i]["bones"][bone].children[child].applyMatrix4(self.objectBones[i]["bones"][bone].matrixWorld);
                }
            }
        }
    }
}

export {InteractiveSkeleton};