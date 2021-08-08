import * as THREE from '../../build/three.module.js';
import { InteractiveSkeleton } from './InteractiveSkeleton.js';

var Object = function(parent, mesh, filename, index, font, camera, userInterface) {
    var self = this;
    self.parent = parent;
    self.mesh = mesh;
    self.filename = filename;
    self.rescaled = false;
    self.animationMixer;
	self.index = index;
	self.font = font;
	self.camera = camera;
	self.text;
	self.selected = false;
	self.boxHelper;
	self.box;
	self.animations;
	self.interactiveSkeletons = [];
	self.group;
	self.globalBoneArray;
	self.userInterface = userInterface;
	self.isInitialized = false;

	self.getTransformGroup = function() {
        if (self.filename.endsWith(".gltf") || self.filename.endsWith(".glb")) var object = self.mesh.scene;
		else var object = self.mesh;
		return object;
	}

	self.generateText = function(text, size) {
		const color = 0xBB00BB;
		var shape = self.font.generateShapes(text, size);
		var geometry = new THREE.ShapeGeometry(shape);
		geometry.computeBoundingBox();
		const xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );
		geometry.translate( xMid, 0, 0 );
		return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial( {
			color: color,
			side: THREE.DoubleSide
		} ));
	}

    self.init = function() {
        if (self.filename.endsWith(".gltf") || self.filename.endsWith(".glb")) var object = self.mesh.scene;
        else var object = self.mesh;
		var objectsToRemove = [];
		object.traverse( function ( child ) {
			if ( child.isMesh ) {
				child.castShadow = true;
                child.receiveShadow = true;
			}
			else if (child.type !== "Group" && child.type !== "Object3D" && child.type !== "Bone"){
				objectsToRemove.push(child);
			}
		} );
		for (var i = 0; i < objectsToRemove.length; i++) {
			object.remove(objectsToRemove[i]);
		}
		self.parent.add(object);

		if (self.filename.endsWith(".gltf") || self.filename.endsWith(".glb")) {
            if (self.mesh.animations.length > 0) {
				self.animations = self.mesh.animations;
				self.animationMixer = new THREE.AnimationMixer(self.mesh.scene);
				for(var i = 0; i < self.mesh.animations.length; i++) {
					const action = self.animationMixer.clipAction(self.mesh.animations[0]);
					//action.play();
				}
            }
        } else{
            if (object.animations.length > 0) {
				self.animations = object.animations;
                self.animationMixer = new THREE.AnimationMixer(object);
                const action = self.animationMixer.clipAction(object.animations[0]);
                //action.play();
            }
        }
		object.updateMatrixWorld();
		
		const box = new THREE.BoxHelper(object, 0xffff00);
		box.geometry.computeBoundingSphere();
		var radius = box.geometry.boundingSphere.radius;
		object.scale.multiplyScalar(120/radius);
        //object.position.set(self.index*200, 0, 0);
		object.updateMatrixWorld();
		self.text = self.generateText(self.filename, object.worldToLocal(new THREE.Vector3(0, 10, 0)).y);
		object.add(self.text);
		self.text.rotation.y = Math.PI/2;
		self.text.position.y = object.worldToLocal(new THREE.Vector3(0, 170, 0)).y;
		self.text.renderOrder = 1;
		self.text.material.depthTest = false;

		box.update();
		box.scale.multiplyScalar(radius/120);
		box.geometry.computeBoundingBox();
		const boxRaycast = new THREE.Mesh(self.makeBoxBufferGeometry(new THREE.Vector3(box.geometry.attributes.position.array[0], box.geometry.attributes.position.array[1], box.geometry.attributes.position.array[2]), new THREE.Vector3(box.geometry.attributes.position.array[3], box.geometry.attributes.position.array[7], box.geometry.attributes.position.array[14])), new THREE.MeshBasicMaterial(0x00ffff));
		boxRaycast.layers.enable(1);
		object.attach(boxRaycast);
		//object.attach(box);
		console.log(box);
		box.position.copy(object.position);
		self.boxHelper = box;
		self.box = boxRaycast;
		self.box.visible = false;
		self.boxHelper.visible = false;
		self.setPosition(new THREE.Vector3(0, 0, index*200));
		var skinnedMeshToRemove = [];
		var meshToAdd = [];

		var rootBonesUUID = [];
		var bonesArray = [];
		var getRoot = function(child) {
            if(child.parent && child.parent.isBone) return getRoot(child.parent);
            return child;
        }
		var jointArray = [];
        var indexJointRecursive = function(parentJoint) {
            for(var c in parentJoint.children) {
                jointArray.push(parentJoint.children[c]);
                indexJointRecursive(parentJoint.children[c]);
            }
        }


		object.traverse( function ( child ) {
			if ( child.isMesh ) {
				child.material.metalness = 0;
				if (child.skeleton) {

					child.updateMatrix();
					child.updateMatrixWorld();
					console.log(child);
					var rootJoint = getRoot(child.skeleton.bones[0]);
					var rootJointIndex = rootBonesUUID.indexOf(rootJoint.uuid);
					if(rootJointIndex !== -1) {
						self.interactiveSkeletons.push(new InteractiveSkeleton(child, {rootJoint: rootJoint, bones: child.skeleton.bones, global: jointArray}, object, self.animations, self.camera, self.userInterface));
					} else {
						jointArray = [rootJoint];
						indexJointRecursive(rootJoint);
						for(var b in jointArray) {
							jointArray[b] = jointArray[b].clone();
						}
						bonesArray.push(jointArray);
						rootBonesUUID.push(rootJoint.uuid);
						self.interactiveSkeletons.push(new InteractiveSkeleton(child, {rootJoint: rootJoint, bones: child.skeleton.bones, global: jointArray}, object, self.animations, self.camera, self.userInterface));

					}

					/*
					skinnedMeshToRemove.push(child);
					var mat = child.material;
					//Array.isArray(mat) ? mat.reduce(function(acc, m){ acc.push(m.clone()); }, []) : mat.clone();
					var clonedMesh = new THREE.Mesh(child.geometry.clone(), mat);
					clonedMesh.matrixAutoUpdate = false;
					child.updateMatrixWorld(true);
					clonedMesh.matrix.copy(child.matrixWorld);
					meshToAdd.push(clonedMesh);
					//child.skeleton.pose();
					self.interactiveSkeletons.push(new InteractiveSkeleton(clonedMesh, child.skeleton, object, self.animations));
					skinnedMeshToRemove.push(child);
					//child.add(new THREE.SkeletonHelper(child.skeleton.bones[0]));*/
				}
			}
		});
		/*
		for(var i in skinnedMeshToRemove) {
			object.remove(skinnedMeshToRemove[i]);
			object.traverse(function(child) {
				child.remove(skinnedMeshToRemove[i]);
			});
		}
		for(var i in meshToAdd) {
			object.attach(meshToAdd[i]);
		}*/
		self.group = object;
		self.globalBoneArray = bonesArray;
		console.log(self);
		self.isInitialized = true;
    }

    self.tick = function(dt, boneControls) {
		for(var skeleton in self.interactiveSkeletons) {
			if(self.interactiveSkeletons[skeleton].isInitialized) self.interactiveSkeletons[skeleton].tick(boneControls);
			else self.interactiveSkeletons[skeleton].init();
		}
		if (self.animationMixer) self.animationMixer.update(dt);
		self.text.rotation.copy(camera.rotation);
		self.boxHelper.visible = self.selected;
    }

	self.select = function(mouse, rendererDomElement) {
		for(var is in self.interactiveSkeletons) {
			self.interactiveSkeletons[is].select(mouse, rendererDomElement, self.camera);
		}
	}
	self.delete = function() {
		self.parent.remove(self.group);
	}

	self.onAfterInteraction = function(mouse) {
		for(var is in self.interactiveSkeletons) {
			self.interactiveSkeletons[is].onAfterInteraction(mouse);
		}
	}
	self.onMouseMove = function(mouse, rendererDomElement) {
		for(var is in self.interactiveSkeletons) {
			if(self.interactiveSkeletons[is].isInitialized) self.interactiveSkeletons[is].onMouseMove(mouse, rendererDomElement);
		}
	}

	self.onStartInteraction = function(mouse) {
		for(var is in self.interactiveSkeletons) {
			self.interactiveSkeletons[is].onStartInteraction(mouse);
		}
	}

	self.setPosition = function(position) {
		self.getTransformGroup().position.copy(position);
	}
	
	self.makeBoxBufferGeometry = function(from, to) {
		const geometry = new THREE.Geometry();
		geometry.vertices.push(
		  new THREE.Vector3(from.x, from.y,  to.z),  // 0
		  new THREE.Vector3( to.x, from.y,  to.z),  // 1
		  new THREE.Vector3(from.x,  to.y,  to.z),  // 2
		  new THREE.Vector3( to.x,  to.y,  to.z),  // 3
		  new THREE.Vector3(from.x, from.y, from.z),  // 4
		  new THREE.Vector3( to.x, from.y, from.z),  // 5
		  new THREE.Vector3(from.x, to.y, from.z),  // 6
		  new THREE.Vector3( to.x,  to.y, from.z),  // 7
		);
	  
		/*
			 6----7
			/|   /|
		   2----3 |
		   | |  | |
		   | 4--|-5
		   |/   |/
		   0----1
		*/
	  
		geometry.faces.push(
		   // front
		   new THREE.Face3(0, 3, 2),
		   new THREE.Face3(0, 1, 3),
		   // right
		   new THREE.Face3(1, 7, 3),
		   new THREE.Face3(1, 5, 7),
		   // back
		   new THREE.Face3(5, 6, 7),
		   new THREE.Face3(5, 4, 6),
		   // left
		   new THREE.Face3(4, 2, 6),
		   new THREE.Face3(4, 0, 2),
		   // top
		   new THREE.Face3(2, 7, 6),
		   new THREE.Face3(2, 3, 7),
		   // bottom
		   new THREE.Face3(4, 1, 0),
		   new THREE.Face3(4, 5, 1),
		);
		return new THREE.BufferGeometry().fromGeometry(geometry);
	}

}

export {Object}