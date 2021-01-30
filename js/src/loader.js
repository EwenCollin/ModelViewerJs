import * as THREE from '../../build/three.module.js';
import { FBXLoader } from '../jsm/loaders/FBXLoader.js';
import { GLTFLoader } from '../jsm/loaders/GLTFLoader.js';
import { Object } from './object.js';

var Loader = function(parentGroup, camera) {
    var self = this;
    self.parentGroup = parentGroup;
    self.loadingManager = new THREE.LoadingManager();
    self.toLoad = [];
    self.toLoadFilenames = [];
    self.loaderFBX = new FBXLoader(self.loadingManager);
    self.loaderGLTF = new GLTFLoader(self.loadingManager);
    self.objects = [];
    self.totalItems = 0;
    self.loadedItems = 0;
    self.camera = camera;
    self.font;

    self.init = function() {
        var loaderJSONFont = new THREE.FontLoader();
        loaderJSONFont.load("/fonts/helvetiker_regular.typeface.json", function(font) {
            self.font = font;
        });
    }
    self.init();

    self.tick = function(dt) {
        for(var i = 0; i < self.objects.length; i++) {
            self.objects[i].tick(dt);
        }
        if (self.loadedItems === self.toLoad.length) {
            document.getElementById("progress-bar2").style.width = 0;
            document.getElementById("progress-bar2").innerText = "";
            document.getElementById("progress").classList.add("hidden");
        }
    }

    self.loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        document.getElementById("progress-bar2").style.width = ((self.loadedItems) / self.totalItems) * 100 + "%";
        document.getElementById("progress-bar2").innerText = self.retrieveFilename(url);
        console.log(self.retrieveFilename(url), "itemsloaded", itemsLoaded, "itemstotal", itemsTotal);
    }

    self.retrieveFilename = function(url) {
        var filenameIndex = 0;
        for(var i = 0; i < self.toLoad.length; i++) {
            if(self.toLoad[i].startsWith(url.slice(0, 256))) {
                filenameIndex = i;
                break;
            }
        }
        return self.toLoadFilenames[filenameIndex];
    }

    self.loadingManager.onLoad = function() {
        if (self.loadedItems === self.toLoad.length) {
            document.getElementById("progress-bar2").style.width = 0;
            document.getElementById("progress-bar2").innerText = "";
            document.getElementById("progress").classList.add("hidden");
        }
    }

    self.addObjectsNbTotal = function(nb) {
        self.totalItems += nb;
    }

    self.addFromUrl = function(url, filename) {
        if (filename.endsWith(".fbx")) {
            self.loaderFBX.load(url, function(object) {
                self.objects.push(new Object(self.parentGroup, object, filename, self.objects.length, self.font, self.camera));
                self.loadedItems++;
            });
        }
        else if (filename.endsWith(".gltf") || filename.endsWith(".glb")) {
            self.loaderGLTF.load(url, function(object) {
                self.objects.push(new Object(self.parentGroup, object, filename, self.objects.length, self.font, self.camera));
                self.loadedItems++;
            });
        }
        self.toLoad.push(url);
        self.toLoadFilenames.push(filename);
    }

    self.getObjects = function() {
        return self.objects;
    }
}

export { Loader };