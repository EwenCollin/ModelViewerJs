import * as THREE from '../../build/three.module.js';
import { TransformControls } from '../ext/TransformControls.js';

var Interaction = function(objects, rendererDomElement, camera, controls, scene) {
    var self = this;
    self.objects = objects;
    self.controls = controls;
    self.rendererDomElement = rendererDomElement;
    self.camera = camera;
    self.scene = scene;
    self.selectedObject;
    self.transformControls = new TransformControls(self.camera, self.rendererDomElement);
    self.boneControls = new TransformControls(self.camera, self.rendererDomElement);
    self.boneControls.setMode("rotate");
    self.boneControls.setSpace("local");
    self.boneControls.setSize(0.5);
    self.boneControls.setSensitivity(0.75);
    self.boneControls.addEventListener('dragging-changed', function (event) {
        self.controls.enabled = !event.value;
    });
    self.transformControls.addEventListener('dragging-changed', function (event) {
        self.controls.enabled = !event.value;
    });
    self.scene.add(self.transformControls);
    self.scene.add(self.boneControls);
    self.raycaster = new THREE.Raycaster();
    self.userInterface;

    self.tick = function(dt) {
        for(var i = 0; i < self.objects.length; i++) {
            self.objects[i].selected = false;
            if(self.objects[i].isInitialized) self.objects[i].tick(dt, self.boneControls);
            else if(!self.objects[i].isLoadBlocked) self.objects[i].init(false);
        }
        if(self.selectedObject !== undefined) {
            self.selectedObject.selected = true;
            //self.selectedObject.tick(dt, self.boneControls);
            self.transformControls.attach(self.selectedObject.getTransformGroup());
        }
    }
    
    self.setUserInterface = function(userInterface) {
        self.userInterface = userInterface;
    }

    self.raycast = function(mouse, objects) {
        const rect = rendererDomElement.getBoundingClientRect();
        var pos = new THREE.Vector2((mouse.x - rect.left) / rect.width, (mouse.y - rect.top) / rect.height);
        var rayPos = new THREE.Vector2((pos.x * 2) - 1, - (pos.y * 2) + 1);
        self.raycaster.setFromCamera(rayPos, self.camera);
        return self.raycaster.intersectObjects(objects, true);
    }
    self.assembleObjects = function() {
        var rObjects = [];
        for(var i = 0;i < self.objects.length; i++) {
            rObjects.push(self.objects[i].group);
        }
        return rObjects;
    }
    
    self.retrieveSelectedObject = function(object) {
        for(var i = 0; i < self.objects.length; i++) {
            var parentArray = [];
            function parentUUIDArray(object) {
                parentArray.push(object.uuid);
                if(object.parent) parentUUIDArray(object.parent);
            }
            parentUUIDArray(object);

            if(parentArray.indexOf(self.objects[i].group.uuid) !== -1) {
                return self.objects[i];
            }
        }
        return undefined;
    }


    self.select = function(mouse) {
        console.log(self.objects);
        var objectsToIntersect = self.assembleObjects();
        var rayResult = self.raycast(mouse, objectsToIntersect);
        if(rayResult.length > 0) {
            var selectedObject = rayResult[0].object;
            var fObject = self.retrieveSelectedObject(selectedObject);
            if (fObject !== undefined && self.selectedObject !== fObject) {
                self.selectedObject = fObject;
                self.userInterface.setCurrentObject(self.selectedObject);
                self.userInterface.setCurrentInteractiveSkeleton(self.selectedObject.interactiveSkeletons);
            } else{
                self.selectedObject.select(mouse, self.rendererDomElement);
            }
        }
    }

    self.onStartInteraction = function(event) {
        if(self.selectedObject !== undefined) {
            self.selectedObject.onStartInteraction(event);
        }
    }
    self.onMouseMove = function(event) {
        if(self.selectedObject !== undefined) {
            self.selectedObject.onMouseMove(event, self.rendererDomElement);
        }
    }

    self.onAfterInteraction = function(mouse) {
        if(self.selectedObject !== undefined) {
            self.selectedObject.onAfterInteraction(mouse);
        }
    }

    self.deleteObject = function(object) {
        var index = self.objects.indexOf(object);
        if(index >= 0) {
            object.delete();
            self.objects.splice(index, 1);
        }
    }

    self.deleteAll = function() {
        self.transformControls.detach();
        self.boneControls.detach();
        for(var obj in self.objects) {
            self.objects[obj].delete();
        }
        self.selectedObject = undefined;
    }

    self.setObjects = function(objects) {
        self.objects = objects;
    }
}

export {Interaction}