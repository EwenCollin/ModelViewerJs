
import * as THREE from '../../build/three.module.js';

var VertexMotionHelper = function () {
    var self = this;
    self.lineArray = [];
    self.positionsHistorySize = 0;
    self.positionsHistoryLimit = 7;
    self.lineGroup = new THREE.Group();
    self.lineGroup.matrixAutoUpdate = false;

    self.update = function (vertexPosition) {
        const shiftLeft = (collection, value, count) => {
            for(var c = 0; c < count; c++) {
                for (let i = 0; i < collection.length - 1; i++) {
                    collection[i] = collection[i + 1];
                }
            }
            for(var c = 0; c < count; c++) {
                collection[collection.length - 1 - c] = value[value.length - 1 - c];
            }
            return collection;
        }
        if (self.lineArray.length * 3 < vertexPosition.length) self.createLineArray(vertexPosition);
        //console.log(self.lineGroup);
        for (var k = 0; k < self.lineArray.length; k++) {
            shiftLeft(self.lineArray[k].geometry.attributes.position.array, [vertexPosition[k * 3], vertexPosition[k * 3 + 1], vertexPosition[k * 3 + 2]], 3);
            self.lineArray[k].geometry.attributes.position.needsUpdate = true;
            self.lineArray[k].computeLineDistances();
            //if(k == 0) console.log(self.lineArray[k].geometry.attributes.position.array);
        }
    }

    self.createLineArray = function (vertexPosition) {
        self.lineArray = [];
        for (var k = 0; k < vertexPosition.length/3; k++) {
            var points = [];
            for (var i = 0; i < self.positionsHistoryLimit; i++) {
                points.push(new THREE.Vector3(vertexPosition[k * 3], vertexPosition[k * 3 + 1], vertexPosition[k * 3 + 2]));
            }
            var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: 0x0000ff}));
            line.material.depthTest = false;
            line.computeLineDistances();
            line.frustumCulled = false;
            line.geometry.setDrawRange(0, 1000);
            self.lineArray.push(line);
            self.lineGroup.attach(line);
        }
    }

    self.getHelperObject = function () {
        return self.lineGroup;
    }

    self.attachTo = function(object, reMatrix) {
        object.attach(self.lineGroup);
        //self.lineGroup.matrix.premultiply(reMatrix.clone().invert());
    }

}
export { VertexMotionHelper };